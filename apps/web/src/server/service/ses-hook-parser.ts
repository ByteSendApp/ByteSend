import {
  EmailStatus,
  SuppressionReason,
  UnsubscribeReason,
} from "@prisma/client";
import {
  SesBounce,
  SesClick,
  SesEvent,
  SesEventDataKey,
} from "~/types/aws-types";
import { db } from "../db";
import {
  unsubscribeContact,
  updateCampaignAnalytics,
} from "./campaign-service";
import { env } from "~/env";
import { getRedis, BULL_PREFIX } from "../redis";
import { Queue, Worker } from "bullmq";
import {
  DEFAULT_QUEUE_OPTIONS,
  SES_WEBHOOK_QUEUE,
} from "../queue/queue-constants";
import { getChildLogger, logger, withLogger } from "../logger/log";
import { randomUUID } from "crypto";
import { SuppressionService } from "./suppression-service";
import { WebhookService } from "./webhook-service";
import { NotificationProviderService } from "./notification-provider-service";
import { NotificationEmitter } from "./notification-emitter";
import { buildEmailWebhookPayload, emailStatusToEvent } from "./email-webhook-payload";

const PROVIDER_EMAIL_EVENTS: Partial<Record<EmailStatus, "delivered" | "bounced" | "complained" | "opened" | "clicked">> = {
  DELIVERED: "delivered",
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  OPENED: "opened",
  CLICKED: "clicked",
};

export async function parseSesHook(data: SesEvent) {
  const mailStatus = getEmailStatus(data);

  if (!mailStatus) {
    logger.error({ data }, "Unknown email status");
    return false;
  }

  const sesEmailId = data.mail.messageId;

  const mailData = getEmailData(data);

  logger.setBindings({
    sesEmailId,
  });

  logger.info({ mailStatus }, "Parsing ses hook");

  let email = await db.email.findUnique({
    where: {
      sesEmailId,
    },
  });

  if (!email) {
    const emailIdHeader = data.mail.headers.find(
      (h) => h.name === "X-ByteSend-Email-ID",
    );

    if (emailIdHeader?.value) {
      email = await db.email.findUnique({
        where: {
          id: emailIdHeader.value,
        },
      });

      if (email) {
        await db.email.update({
          where: { id: email.id },
          data: { sesEmailId },
        });
        logger.info(
          { emailId: email.id, sesEmailId },
          "Updated email with sesEmailId from webhook (race condition resolved)",
        );
      }
    }
  }

  logger.setBindings({
    sesEmailId,
    mailId: email?.id,
    teamId: email?.teamId,
  });

  if (!email) {
    logger.error({ data }, "Email not found");
    return false;
  }

  if (
    email.latestStatus === mailStatus &&
    mailStatus === EmailStatus.DELIVERY_DELAYED
  ) {
    return true;
  }

  await db.$executeRaw`
      UPDATE "Email"
      SET "latestStatus" = CASE
        WHEN ${mailStatus}::text::\"EmailStatus\" > "latestStatus" OR "latestStatus" IS NULL OR "latestStatus" = 'SCHEDULED'::\"EmailStatus\"
        THEN ${mailStatus}::text::\"EmailStatus\"
        ELSE "latestStatus"
      END
      WHERE id = ${email.id}
    `;

  logger.info("Latest status updated");

  const providerEvent = PROVIDER_EMAIL_EVENTS[mailStatus];
  if (providerEvent) {
    NotificationEmitter.emitEmailEvent(email.teamId, providerEvent, {
      emailId: email.id,
      to: email.to.join(", "),
      subject: email.subject,
    }).catch((error) => logger.warn({ err: error, emailId: email.id }, "Notification failed"));
  }

  const today = new Date().toISOString().split("T")[0] as string;

  const isHardBounced =
    mailStatus === EmailStatus.BOUNCED &&
    (mailData as SesBounce).bounceType === "Permanent";

  if (isHardBounced || mailStatus === EmailStatus.COMPLAINED) {
    logger.info("Adding emails to suppression list");

    let recipientEmails: string[] = [];

    if (isHardBounced && data.bounce?.bouncedRecipients) {
      recipientEmails = data.bounce.bouncedRecipients.map(
        (recipient) => recipient.emailAddress,
      );
    } else if (
      mailStatus === EmailStatus.COMPLAINED &&
      data.complaint?.complainedRecipients
    ) {
      recipientEmails = data.complaint.complainedRecipients.map(
        (recipient) => recipient.emailAddress,
      );
    }

    if (recipientEmails.length > 0) {
      try {
        await Promise.all(
          recipientEmails.map((recipientEmail) =>
            SuppressionService.addSuppression({
              email: recipientEmail,
              teamId: email.teamId,
              reason: isHardBounced
                ? SuppressionReason.HARD_BOUNCE
                : SuppressionReason.COMPLAINT,
              source: email.id,
            }),
          ),
        );

        logger.info(
          {
            emailId: email.id,
            recipients: recipientEmails,
            reason: isHardBounced ? "HARD_BOUNCE" : "COMPLAINT",
          },
          "Added emails to suppression list due to bounce/complaint",
        );
      } catch (error) {
        logger.error(
          {
            emailId: email.id,
            recipients: recipientEmails,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Failed to add emails to suppression list",
        );
      }
    } else {
      logger.warn(
        {
          emailId: email.id,
          eventType: data.eventType,
        },
        "No affected recipients found in bounce/complaint event data",
      );
    }

    const eventLabel = isHardBounced ? "Hard Bounce" : "Complaint";
    const recipientCount = isHardBounced
      ? (data.bounce?.bouncedRecipients?.length ?? email.to.length)
      : (data.complaint?.complainedRecipients?.length ?? email.to.length);
    const eventType = isHardBounced ? "EMAIL_BOUNCED" : "EMAIL_COMPLAINED";

    NotificationProviderService.broadcastNotification(
      email.teamId,
      eventType as import("@prisma/client").NotificationEventType,
      {
        title: `⚠️ ${eventLabel} Detected`,
        description: `A ${eventLabel.toLowerCase()} was triggered for an outgoing email.`,
        color: isHardBounced ? "#EF4444" : "#F97316",
        fields: [
          { name: "Email ID", value: email.id, inline: true },
          { name: "Recipients Affected", value: String(recipientCount), inline: true },
          { name: "Subject", value: email.subject ?? "—", inline: false },
        ],
        timestamp: true,
      }
    ).catch(() => void 0);
  }

  if (
    [
      "DELIVERED",
      "OPENED",
      "CLICKED",
      "BOUNCED",
      "COMPLAINED",
    ].includes(mailStatus)
  ) {
    logger.info("Updating daily email usage");
    const updateField = mailStatus.toLowerCase();

    await db.dailyEmailUsage.upsert({
      where: {
        teamId_domainId_date_type: {
          teamId: email.teamId,
          domainId: email.domainId ?? 0,
          date: today,
          type: email.campaignId ? "MARKETING" : "TRANSACTIONAL",
        },
      },
      create: {
        teamId: email.teamId,
        domainId: email.domainId ?? 0,
        date: today,
        type: email.campaignId ? "MARKETING" : "TRANSACTIONAL",
        delivered: updateField === "delivered" ? 1 : 0,
        opened: updateField === "opened" ? 1 : 0,
        clicked: updateField === "clicked" ? 1 : 0,
        bounced: updateField === "bounced" ? 1 : 0,
        complained: updateField === "complained" ? 1 : 0,
        hardBounced: isHardBounced ? 1 : 0,
      },
      update: {
        [updateField]: {
          increment: 1,
        },
        ...(isHardBounced ? { hardBounced: { increment: 1 } } : {}),
      },
    });

    if (
      isHardBounced ||
      updateField === "complained" ||
      updateField === "delivered"
    ) {
      logger.info("Updating cumulated metrics");
      const cumulatedField = isHardBounced ? "hardBounced" : updateField;
      await db.cumulatedMetrics.upsert({
        where: {
          teamId_domainId: {
            teamId: email.teamId,
            domainId: email.domainId ?? 0,
          },
        },
        update: {
          [cumulatedField]: {
            increment: BigInt(1),
          },
        },
        create: {
          teamId: email.teamId,
          domainId: email.domainId ?? 0,
          [cumulatedField]: BigInt(1),
        },
      });
    }
  }

  if (email.campaignId) {
    if (
      mailStatus !== "CLICKED" ||
      !(mailData as SesClick).link.startsWith(`${env.NEXTAUTH_URL}/unsubscribe`)
    ) {
      await checkUnsubscribe({
        contactId: email.contactId!,
        campaignId: email.campaignId,
        teamId: email.teamId,
        event: mailStatus,
        mailData: data,
      });

      const mailEvent = await db.emailEvent.findFirst({
        where: {
          emailId: email.id,
          status: mailStatus,
        },
      });

      if (!mailEvent) {
        await updateCampaignAnalytics(
          email.campaignId,
          mailStatus,
          isHardBounced,
        );
      }
    }
  }

  logger.info("Creating email event");

  await db.emailEvent.create({
    data: {
      emailId: email.id,
      status: mailStatus,
      data: mailData as any,
      teamId: email.teamId,
    },
  });

  logger.info("Email event created");

  try {
    const occurredAt = data.mail.timestamp
      ? new Date(data.mail.timestamp).toISOString()
      : new Date().toISOString();

    const metadata = buildEmailMetadata(mailStatus, mailData);

    await WebhookService.emit(
      email.teamId,
      emailStatusToEvent(mailStatus),
      buildEmailWebhookPayload({
        email,
        status: mailStatus,
        occurredAt,
        eventData: mailData,
        metadata,
      }),
      {
        domainId: email.domainId ?? null,
      },
    );
  } catch (error) {
    logger.error(
      { error, emailId: email.id, mailStatus },
      "[SesHookParser]: Failed to emit webhook",
    );
  }

  return true;
}

function buildEmailMetadata(
  status: EmailStatus,
  mailData: SesEvent | SesEvent[SesEventDataKey],
) {
  switch (status) {
    case EmailStatus.BOUNCED: {
      const bounce = mailData as SesBounce;
      return {
        bounceType: bounce.bounceType,
        bounceSubType: bounce.bounceSubType,
        diagnosticCode: bounce.bouncedRecipients?.[0]?.diagnosticCode,
      };
    }
    case EmailStatus.COMPLAINED: {
      const complaintInfo = (mailData as any)?.complaint ?? mailData;
      return {
        feedbackType: complaintInfo?.complaintFeedbackType,
        userAgent: complaintInfo?.userAgent,
      };
    }
    case EmailStatus.OPENED: {
      const openData = (mailData as any)?.open ?? mailData;
      return {
        ipAddress: openData?.ipAddress,
        userAgent: openData?.userAgent,
      };
    }
    case EmailStatus.CLICKED: {
      const click = mailData as SesClick;
      return {
        ipAddress: click.ipAddress,
        userAgent: click.userAgent,
        link: click.link,
      };
    }
    case EmailStatus.RENDERING_FAILURE: {
      const failure = mailData as SesEvent["renderingFailure"];
      return {
        errorMessage: failure?.errorMessage,
        templateName: failure?.templateName,
      };
    }
    case EmailStatus.DELIVERY_DELAYED: {
      const deliveryDelay = mailData as SesEvent["deliveryDelay"];
      return {
        delayType: deliveryDelay?.delayType,
        expirationTime: deliveryDelay?.expirationTime,
        delayedRecipients: deliveryDelay?.delayedRecipients,
      };
    }
    case EmailStatus.REJECTED: {
      const reject = mailData as SesEvent["reject"];
      return {
        reason: reject?.reason,
      };
    }
    default:
      return undefined;
  }
}

async function checkUnsubscribe({
  contactId,
  campaignId,
  teamId,
  event,
  mailData,
}: {
  contactId: string;
  campaignId: string;
  teamId: number;
  event: EmailStatus;
  mailData: SesEvent;
}) {
  if (
    (event === EmailStatus.BOUNCED &&
      mailData.bounce?.bounceType === "Permanent") ||
    event === EmailStatus.COMPLAINED
  ) {
    const contact = await db.contact.findUnique({
      where: {
        id: contactId,
      },
    });

    if (!contact) {
      return;
    }

    const allContacts = await db.contact.findMany({
      where: {
        email: contact.email,
        contactBook: {
          teamId,
        },
      },
    });

    const allContactIds = allContacts
      .map((c) => c.id)
      .filter((c) => c !== contactId);

    await Promise.all([
      unsubscribeContact({
        contactId,
        campaignId,
        reason:
          event === EmailStatus.BOUNCED
            ? UnsubscribeReason.BOUNCED
            : UnsubscribeReason.COMPLAINED,
      }),
      ...allContactIds.map((c) =>
        unsubscribeContact({
          contactId: c,
          reason:
            event === EmailStatus.BOUNCED
              ? UnsubscribeReason.BOUNCED
              : UnsubscribeReason.COMPLAINED,
        }),
      ),
    ]);
  }
}

function getEmailStatus(data: SesEvent) {
  const { eventType } = data;

  if (eventType === "Send") {
    return EmailStatus.SENT;
  } else if (eventType === "Delivery") {
    return EmailStatus.DELIVERED;
  } else if (eventType === "Bounce") {
    return EmailStatus.BOUNCED;
  } else if (eventType === "Complaint") {
    return EmailStatus.COMPLAINED;
  } else if (eventType === "Reject") {
    return EmailStatus.REJECTED;
  } else if (eventType === "Open") {
    return EmailStatus.OPENED;
  } else if (eventType === "Click") {
    return EmailStatus.CLICKED;
  } else if (eventType === "Rendering Failure") {
    return EmailStatus.RENDERING_FAILURE;
  } else if (eventType === "DeliveryDelay") {
    return EmailStatus.DELIVERY_DELAYED;
  }
}

function getEmailData(data: SesEvent) {
  const { eventType } = data;

  if (eventType === "Rendering Failure") {
    return data.renderingFailure;
  } else if (eventType === "DeliveryDelay") {
    return data.deliveryDelay;
  } else {
    return data[eventType.toLowerCase() as SesEventDataKey];
  }
}

export class SesHookParser {
  private static sesHookQueue = new Queue(SES_WEBHOOK_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });

  private static worker = new Worker(
    SES_WEBHOOK_QUEUE,
    async (job) => {
      return await withLogger(
        getChildLogger({
          queueId: job.id ?? randomUUID(),
        }),
        async () => {
          await this.execute(job.data);
        },
      );
    },
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
      concurrency: 50,
    },
  );

  private static async execute(event: SesEvent) {
    try {
      await parseSesHook(event);
    } catch (error) {
      logger.error({ error }, "Error parsing ses hook");
      throw error;
    }
  }

  static async queue(data: { event: SesEvent; messageId: string }) {
    return await this.sesHookQueue.add(
      data.messageId,
      data.event,
      DEFAULT_QUEUE_OPTIONS,
    );
  }
}
