import { EmailRenderer } from "@bytesend/email-editor/src/renderer";
import { wakeCampaignScheduler } from "../queue/campaign-scheduler-state";
import { SpamScanService } from "./spam-scan-service";
import { db } from "../db";
import { createHash } from "crypto";
import { env } from "~/env";
import { getContactPropertyValue } from "~/lib/contact-properties";
import {
  Campaign,
  Contact,
  EmailStatus,
  UnsubscribeReason,
} from "@prisma/client";
import { EmailQueueService } from "./email-queue-service";
import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "../redis";
import {
  CAMPAIGN_BATCH_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { logger } from "../logger/log";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import { SuppressionService } from "./suppression-service";
import { ByteSendApiError } from "../public-api/api-error";
import {
  validateApiKeyDomainAccess,
  validateDomainFromEmail,
} from "./domain-service";
import { LimitService } from "./limit-service";
import { NotificationEmitter } from "./notification-emitter";

/** Tells the team's notification providers about a campaign starting or finishing. Never throws. */
function notifyCampaign(campaign: { id: string; name: string; teamId: number }, event: "started" | "completed") {
  NotificationEmitter.emitCampaignEvent(campaign.teamId, event, {
    campaignId: campaign.id,
    campaignName: campaign.name,
  }).catch((error) => logger.warn({ err: error, campaignId: campaign.id }, "[CampaignService]: Notification failed"));
}

const CAMPAIGN_UNSUB_PLACEHOLDER_TOKENS = [
  "{{bytesend_unsubscribe_url}}",
] as const;

const CAMPAIGN_UNSUB_PLACEHOLDER_REGEXES =
  CAMPAIGN_UNSUB_PLACEHOLDER_TOKENS.map((placeholder) => {
    const inner = placeholder.replace(/[{}]/g, "").trim();
    return new RegExp(`\\{\\{\\s*${inner}\\s*\\}}`, "i");
  });

const CONTACT_VARIABLE_REGEX =
  /\{\{\s*(?:contact\.)?([a-zA-Z0-9_]+)(?:,fallback=([^}]+))?\s*\}\}/gi;

const BUILT_IN_CONTACT_VARIABLES = ["email", "firstName", "lastName"] as const;

function getContactReplacementValue({
  contact,
  key,
  allowedVariables,
}: {
  contact: Contact;
  key: string;
  allowedVariables: string[];
}) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "email") {
    return contact.email;
  }

  if (normalizedKey === "firstname") {
    return contact.firstName;
  }

  if (normalizedKey === "lastname") {
    return contact.lastName;
  }

  const variableMap = new Map(
    allowedVariables.map((variable) => [variable.toLowerCase(), variable]),
  );
  const matchedVariable = variableMap.get(normalizedKey);
  if (!matchedVariable) {
    return undefined;
  }

  if (!contact.properties || typeof contact.properties !== "object") {
    return undefined;
  }

  return getContactPropertyValue(
    contact.properties as Record<string, unknown>,
    matchedVariable,
    allowedVariables,
  );
}

function createCaseInsensitiveVariableValues(
  values: Record<string, string | null | undefined>,
) {
  const normalizedValues = Object.entries(values).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
        acc[key.toLowerCase()] = value;
      }

      return acc;
    },
    {} as Record<string, string | null>,
  );

  return new Proxy(normalizedValues, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const exact = Reflect.get(target, prop, receiver);
        if (exact !== undefined) {
          return exact;
        }

        return Reflect.get(target, prop.toLowerCase(), receiver);
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as Record<string, string | null>;
}

function campaignHasUnsubscribePlaceholder(
  ...sources: Array<string | null | undefined>
) {
  return CAMPAIGN_UNSUB_PLACEHOLDER_REGEXES.some((regex) =>
    sources.some((source) => (source ? regex.test(source) : false)),
  );
}

function replaceUnsubscribePlaceholders(html: string, url: string) {
  return CAMPAIGN_UNSUB_PLACEHOLDER_REGEXES.reduce((acc, regex) => {
    return acc.replace(new RegExp(regex.source, "gi"), url);
  }, html);
}

function replaceContactVariables(
  html: string,
  contact: Contact,
  allowedVariables: string[],
) {
  return html.replace(
    CONTACT_VARIABLE_REGEX,
    (match: string, key: string, fallback?: string) => {
      const normalizedKey = key.toLowerCase();
      const isBuiltIn = BUILT_IN_CONTACT_VARIABLES.some(
        (variable) => variable.toLowerCase() === normalizedKey,
      );
      const isAllowedRegistryVariable = allowedVariables.some(
        (variable) => variable.toLowerCase() === normalizedKey,
      );

      if (!isBuiltIn && !isAllowedRegistryVariable) {
        return match;
      }

      const contactValue = getContactReplacementValue({
        contact,
        key,
        allowedVariables,
      });

      if (contactValue && contactValue.length > 0) {
        return contactValue;
      }

      return fallback ?? "";
    },
  );
}

function sanitizeAddressList(addresses?: string | string[]) {
  if (!addresses) {
    return [] as string[];
  }

  const list = Array.isArray(addresses) ? addresses : [addresses];

  return list
    .map((address) => address.trim())
    .filter((address) => address.length > 0);
}

async function prepareCampaignHtml(
  campaign: Campaign,
): Promise<{ campaign: Campaign; html: string }> {
  if (campaign.content) {
    try {
      const jsonContent = JSON.parse(campaign.content);
      const renderer = new EmailRenderer(jsonContent);
      const html = await renderer.render();

      if (campaign.html !== html) {
        campaign = await db.campaign.update({
          where: { id: campaign.id },
          data: { html },
        });
      }

      return { campaign, html };
    } catch (error) {
      logger.error({ err: error }, "Failed to parse campaign content");
      throw new Error("Failed to parse campaign content");
    }
  }

  if (campaign.html) {
    return { campaign, html: campaign.html };
  }

  throw new Error("No content added for campaign");
}

async function renderCampaignHtmlForContact({
  campaign,
  contact,
  unsubscribeUrl,
  allowedVariables,
}: {
  campaign: Campaign;
  contact: Contact;
  unsubscribeUrl: string;
  allowedVariables: string[];
}) {
  if (campaign.content) {
    try {
      const jsonContent = JSON.parse(campaign.content);
      const renderer = new EmailRenderer(jsonContent);
      const linkValues: Record<string, string> = {};

      for (const token of CAMPAIGN_UNSUB_PLACEHOLDER_TOKENS) {
        linkValues[token] = unsubscribeUrl;
      }

      const variableValues = createCaseInsensitiveVariableValues({
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        ...allowedVariables.reduce(
          (acc, variable) => {
            const value = getContactReplacementValue({
              contact,
              key: variable,
              allowedVariables,
            });

            if (value !== undefined) {
              acc[variable] = value;
            }

            return acc;
          },
          {} as Record<string, string | null | undefined>,
        ),
      });

      return renderer.render({
        shouldReplaceVariableValues: true,
        variableValues,
        linkValues,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to parse campaign content");
      throw new Error("Failed to parse campaign content");
    }
  }

  if (!campaign.html) {
    throw new Error("No HTML content for campaign");
  }

  let html = replaceUnsubscribePlaceholders(campaign.html, unsubscribeUrl);
  html = replaceContactVariables(html, contact, allowedVariables);

  return html;
}

export async function createCampaignFromApi({
  teamId,
  apiKeyId,
  name,
  from,
  subject,
  previewText,
  content,
  html,
  contactBookId,
  replyTo,
  cc,
  bcc,
  batchSize,
}: {
  teamId: number;
  apiKeyId?: number;
  name: string;
  from: string;
  subject: string;
  previewText?: string;
  content?: string;
  html?: string;
  contactBookId: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  batchSize?: number;
}) {
  const campaignLimit = await LimitService.checkCampaignLimit(teamId);
  if (campaignLimit.isLimitReached) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: `You have reached the campaign limit (${campaignLimit.currentCount}/${campaignLimit.limit}) for your current plan. Upgrade to create more campaigns.`,
    });
  }

  if (!content && !html) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Either content or html must be provided",
    });
  }

  if (content) {
    try {
      JSON.parse(content);
    } catch (error) {
      logger.error({ err: error }, "Invalid campaign content JSON from API");
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: "Invalid content JSON",
      });
    }
  }

  const contactBook = await db.contactBook.findUnique({
    where: { id: contactBookId, teamId },
    select: { id: true },
  });

  if (!contactBook) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Contact book not found",
    });
  }

  let domain;

  if (apiKeyId) {
    const apiKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { domain: true },
    });

    if (!apiKey || apiKey.teamId !== teamId) {
      throw new ByteSendApiError({
        code: "FORBIDDEN",
        message: "Invalid API key",
      });
    }

    domain = await validateApiKeyDomainAccess(from, teamId, apiKey);
  } else {
    domain = await validateDomainFromEmail(from, teamId);
  }

  const sanitizedHtml = html?.trim();
  const sanitizedContent = content ?? null;

  const unsubPlaceholderFound = campaignHasUnsubscribePlaceholder(
    sanitizedContent,
    sanitizedHtml,
  );

  if (!unsubPlaceholderFound) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "Campaign must include an unsubscribe link before sending",
    });
  }

  const campaign = await db.campaign.create({
    data: {
      name,
      from,
      subject,
      isApi: true,
      ...(previewText !== undefined ? { previewText } : {}),
      content: sanitizedContent,
      ...(sanitizedHtml && sanitizedHtml.length > 0
        ? { html: sanitizedHtml }
        : {}),
      contactBookId,
      replyTo: sanitizeAddressList(replyTo),
      cc: sanitizeAddressList(cc),
      bcc: sanitizeAddressList(bcc),
      teamId,
      domainId: domain.id,
      ...(typeof batchSize === "number" ? { batchSize } : {}),
    },
  });

  return campaign;
}

export async function getCampaignForTeam({
  campaignId,
  teamId,
}: {
  campaignId: string;
  teamId: number;
}) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, teamId },
    select: {
      id: true,
      name: true,
      from: true,
      subject: true,
      previewText: true,
      contactBookId: true,
      html: true,
      content: true,
      status: true,
      scheduledAt: true,
      batchSize: true,
      batchWindowMinutes: true,
      total: true,
      sent: true,
      delivered: true,
      opened: true,
      clicked: true,
      unsubscribed: true,
      bounced: true,
      hardBounced: true,
      complained: true,
      replyTo: true,
      cc: true,
      bcc: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!campaign) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  return campaign;
}

export async function sendCampaign(id: string, { skipSpamScan = false }: { skipSpamScan?: boolean } = {}) {
  let campaign = await db.campaign.findUnique({
    where: { id },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const prepared = await prepareCampaignHtml(campaign);
  campaign = prepared.campaign;
  const html = prepared.html;

  if (!campaign.contactBookId) {
    throw new Error("No contact book found for campaign");
  }

  if (!html) {
    throw new Error("No HTML content for campaign");
  }

  const unsubPlaceholderFound = campaignHasUnsubscribePlaceholder(
    campaign.content,
    html,
  );

  if (!unsubPlaceholderFound) {
    throw new Error("Campaign must include an unsubscribe link before sending");
  }

  if (!skipSpamScan) {
    const team = await db.team.findUnique({ where: { id: campaign.teamId }, select: { createdAt: true } });
    const spamResult = await SpamScanService.scan({
      from: campaign.from,
      subject: campaign.subject,
      html,
      teamCreatedAt: team?.createdAt,
    });
    await SpamScanService.record({ teamId: campaign.teamId, campaignId: id, result: spamResult });
    if (spamResult.verdict === "HOLD") {
      await db.campaign.update({ where: { id }, data: { status: "PAUSED" } });
      throw new ByteSendApiError({
        code: "FORBIDDEN",
        message:
          "This campaign was held for review by ByteSend's spam protection. Our team will review it shortly, or contact support.",
      });
    }
  }

  const total = await db.contact.count({
    where: { contactBookId: campaign.contactBookId, subscribed: true },
  });

  await db.campaign.update({
    where: { id },
    data: {
      status: "SCHEDULED",
      total,
      scheduledAt: campaign.scheduledAt ?? new Date(),
      lastCursor: campaign.lastCursor ?? null,
    },
  });
  await wakeCampaignScheduler();

  await CampaignBatchService.queueBatch({
    campaignId: id,
    teamId: campaign.teamId,
  });
}

export async function scheduleCampaign({
  campaignId,
  teamId,
  scheduledAt: scheduledAtInput,
  batchSize,
}: {
  campaignId: string;
  teamId: number;
  scheduledAt?: Date | string;
  batchSize?: number;
}) {
  let campaign = await db.campaign.findUnique({
    where: { id: campaignId, teamId },
  });
  if (!campaign) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  let html: string;
  try {
    const prepared = await prepareCampaignHtml(campaign);
    campaign = prepared.campaign;
    html = prepared.html;
  } catch (err) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: err instanceof Error ? err.message : "Invalid campaign content",
    });
  }

  const isDirectBroadcast =
    campaign.intent === "BROADCAST" && campaign.recipientEmails.length > 0;

  if (!isDirectBroadcast && !campaign.contactBookId) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "No contact book or recipients found for campaign",
    });
  }

  if (!html) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "No HTML content for campaign",
    });
  }

  if (!isDirectBroadcast) {
    const unsubPlaceholderFound = campaignHasUnsubscribePlaceholder(
      campaign.content,
      html,
    );
    if (!unsubPlaceholderFound) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: "Campaign must include an unsubscribe link before scheduling",
      });
    }
  }

  let total: number;
  if (isDirectBroadcast) {
    total = campaign.recipientEmails.length;
  } else {
    total = await db.contact.count({
      where: { contactBookId: campaign.contactBookId!, subscribed: true },
    });
    if (total === 0) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: "No subscribed contacts to send",
      });
    }
  }

  const scheduledAt = scheduledAtInput
    ? scheduledAtInput instanceof Date
      ? scheduledAtInput
      : new Date(scheduledAtInput)
    : new Date();

  const shouldResetCursor =
    campaign.status === "DRAFT" || campaign.status === "SENT";

  await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "SCHEDULED",
      scheduledAt,
      total,
      ...(batchSize ? { batchSize } : {}),
      ...(shouldResetCursor ? { lastCursor: null } : {}),
    },
  });
  await wakeCampaignScheduler();

  return { ok: true };
}

export async function pauseCampaign({
  campaignId,
  teamId,
}: {
  campaignId: string;
  teamId: number;
}) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId, teamId },
  });

  if (!campaign) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });

  return { ok: true };
}

export async function resumeCampaign({
  campaignId,
  teamId,
}: {
  campaignId: string;
  teamId: number;
}) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId, teamId },
  });

  if (!campaign) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()) {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "SCHEDULED" },
    });
  } else {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "RUNNING" },
    });
    notifyCampaign(campaign, "started");
  }
  await wakeCampaignScheduler();

  return { ok: true };
}

export function createUnsubUrl(contactId: string, campaignId: string) {
  const unsubId = `${contactId}-${campaignId}`;

  const unsubHash = createHash("sha256")
    .update(`${unsubId}-${env.NEXTAUTH_SECRET}`)
    .digest("hex");

  return `${env.NEXTAUTH_URL}/unsubscribe?id=${unsubId}&hash=${unsubHash}`;
}

export function createOneClickUnsubUrl(contactId: string, campaignId: string) {
  const unsubId = `${contactId}-${campaignId}`;

  const unsubHash = createHash("sha256")
    .update(`${unsubId}-${env.NEXTAUTH_SECRET}`)
    .digest("hex");

  return `${env.NEXTAUTH_URL}/api/unsubscribe-oneclick?id=${unsubId}&hash=${unsubHash}`;
}

export async function unsubscribeContactFromLink(id: string, hash: string) {
  const [contactId, campaignId] = id.split("-");

  if (!contactId || !campaignId) {
    throw new Error("Invalid unsubscribe link");
  }

  const expectedHash = createHash("sha256")
    .update(`${id}-${env.NEXTAUTH_SECRET}`)
    .digest("hex");

  if (hash !== expectedHash) {
    throw new Error("Invalid unsubscribe link");
  }

  return await unsubscribeContact({
    contactId,
    campaignId,
    reason: UnsubscribeReason.UNSUBSCRIBED,
  });
}

export async function unsubscribeContact({
  contactId,
  campaignId,
  reason,
}: {
  contactId: string;
  campaignId?: string;
  reason: UnsubscribeReason;
}) {
  try {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new Error("Contact not found");
    }

    if (contact.subscribed) {
      await db.contact.update({
        where: { id: contactId },
        data: { subscribed: false, unsubscribeReason: reason },
      });

      if (campaignId) {
        await db.campaign.update({
          where: { id: campaignId },
          data: {
            unsubscribed: {
              increment: 1,
            },
          },
        });
      }
    }

    return contact;
  } catch (error) {
    logger.error({ err: error }, "Error unsubscribing contact");
    throw new Error("Failed to unsubscribe contact");
  }
}

export async function subscribeContact(id: string, hash: string) {
  const [contactId, campaignId] = id.split("-");

  if (!contactId || !campaignId) {
    throw new Error("Invalid subscribe link");
  }

  const expectedHash = createHash("sha256")
    .update(`${id}-${env.NEXTAUTH_SECRET}`)
    .digest("hex");

  if (hash !== expectedHash) {
    throw new Error("Invalid subscribe link");
  }

  try {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new Error("Contact not found");
    }

    if (!contact.subscribed) {
      await db.contact.update({
        where: { id: contactId },
        data: { subscribed: true },
      });

      await db.campaign.update({
        where: { id: campaignId },
        data: {
          unsubscribed: {
            decrement: 1,
          },
        },
      });
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, "Error subscribing contact");
    throw new Error("Failed to subscribe contact");
  }
}

export async function deleteCampaign(id: string, teamId: number) {
  const existing = await db.campaign.findFirst({
    where: { id, teamId },
  });

  if (!existing) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Campaign not found",
    });
  }

  const campaign = await db.$transaction(async (tx) => {
    await tx.campaignEmail.deleteMany({
      where: { campaignId: id },
    });

    const campaign = await tx.campaign.delete({
      where: { id },
    });

    return campaign;
  });

  return campaign;
}

type CampaignEmailJob = {
  contact: Contact;
  campaign: Campaign;
  allowedVariables: string[];
  emailConfig: {
    from: string;
    subject: string;
    replyTo?: string[];
    cc?: string[];
    bcc?: string[];
    teamId: number;
    campaignId: string;
    previewText?: string;
    domainId: number;
    region: string;
  };
};

async function processContactEmail(jobData: CampaignEmailJob) {
  const { contact, campaign, emailConfig, allowedVariables } = jobData;

  const unsubscribeUrl = createUnsubUrl(contact.id, emailConfig.campaignId);
  const oneClickUnsubUrl = createOneClickUnsubUrl(
    contact.id,
    emailConfig.campaignId,
  );

  const toEmails = [contact.email];
  const ccEmails = emailConfig.cc || [];
  const bccEmails = emailConfig.bcc || [];

  const allEmailsToCheck = [
    ...new Set([...toEmails, ...ccEmails, ...bccEmails]),
  ];

  const suppressionResults = await SuppressionService.checkMultipleEmails(
    allEmailsToCheck,
    emailConfig.teamId,
  );

  const filteredToEmails = toEmails.filter(
    (email) => !suppressionResults[email],
  );
  const filteredCcEmails = ccEmails.filter(
    (email) => !suppressionResults[email],
  );
  const filteredBccEmails = bccEmails.filter(
    (email) => !suppressionResults[email],
  );

  const isContactSuppressed = filteredToEmails.length === 0;

  const html = await renderCampaignHtmlForContact({
    campaign,
    contact,
    unsubscribeUrl,
    allowedVariables,
  });

  if (isContactSuppressed) {
    logger.info(
      {
        contactEmail: contact.email,
        campaignId: emailConfig.campaignId,
        teamId: emailConfig.teamId,
      },
      "Contact email is suppressed. Creating suppressed email record.",
    );

    const email = await db.email.create({
      data: {
        to: toEmails,
        replyTo: emailConfig.replyTo,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        from: emailConfig.from,
        subject: emailConfig.subject,
        html,
        text: emailConfig.previewText,
        teamId: emailConfig.teamId,
        campaignId: emailConfig.campaignId,
        contactId: contact.id,
        domainId: emailConfig.domainId,
        latestStatus: "SUPPRESSED",
      },
    });

    await db.emailEvent.create({
      data: {
        emailId: email.id,
        status: "SUPPRESSED",
        data: {
          error: "Contact email is suppressed. No email sent.",
        },
        teamId: emailConfig.teamId,
      },
    });

    try {
      await db.campaignEmail.create({
        data: {
          campaignId: emailConfig.campaignId,
          contactId: contact.id,
          emailId: email.id,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to create campaign email record");
    }

    return;
  }

  if (ccEmails.length > filteredCcEmails.length) {
    logger.info(
      {
        originalCc: ccEmails,
        filteredCc: filteredCcEmails,
        campaignId: emailConfig.campaignId,
        teamId: emailConfig.teamId,
      },
      "Some CC recipients were suppressed and filtered out from campaign email.",
    );
  }

  if (bccEmails.length > filteredBccEmails.length) {
    logger.info(
      {
        originalBcc: bccEmails,
        filteredBcc: filteredBccEmails,
        campaignId: emailConfig.campaignId,
        teamId: emailConfig.teamId,
      },
      "Some BCC recipients were suppressed and filtered out from campaign email.",
    );
  }

  const email = await db.email.create({
    data: {
      to: filteredToEmails,
      replyTo: emailConfig.replyTo,
      cc: filteredCcEmails.length > 0 ? filteredCcEmails : undefined,
      bcc: filteredBccEmails.length > 0 ? filteredBccEmails : undefined,
      from: emailConfig.from,
      subject: emailConfig.subject,
      html,
      text: emailConfig.previewText,
      teamId: emailConfig.teamId,
      campaignId: emailConfig.campaignId,
      contactId: contact.id,
      domainId: emailConfig.domainId,
    },
  });

  try {
    await db.campaignEmail.create({
      data: {
        campaignId: emailConfig.campaignId,
        contactId: contact.id,
        emailId: email.id,
      },
    });
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to create campaign email record so skipping email sending",
    );
    return;
  }

  await EmailQueueService.queueEmail(
    email.id,
    emailConfig.teamId,
    emailConfig.region,
    false,
    oneClickUnsubUrl,
  );
}

export async function updateCampaignAnalytics(
  campaignId: string,
  emailStatus: EmailStatus,
  hardBounce: boolean = false,
) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const updateData: Record<string, any> = {};

  switch (emailStatus) {
    case EmailStatus.SENT:
      updateData.sent = { increment: 1 };
      break;
    case EmailStatus.DELIVERED:
      updateData.delivered = { increment: 1 };
      break;
    case EmailStatus.OPENED:
      updateData.opened = { increment: 1 };
      break;
    case EmailStatus.CLICKED:
      updateData.clicked = { increment: 1 };
      break;
    case EmailStatus.BOUNCED:
      updateData.bounced = { increment: 1 };
      if (hardBounce) {
        updateData.hardBounced = { increment: 1 };
      }
      break;
    case EmailStatus.COMPLAINED:
      updateData.complained = { increment: 1 };
      break;
    default:
      break;
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: updateData,
  });
}

type CampaignBatchJob = TeamJob<{ campaignId: string }>;

export class CampaignBatchService {
  private static batchQueue = new Queue<CampaignBatchJob>(
    CAMPAIGN_BATCH_QUEUE,
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  static worker = new Worker(
    CAMPAIGN_BATCH_QUEUE,
    createWorkerHandler(async (job: CampaignBatchJob) => {
      const { campaignId } = job.data;

      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) return;

      const isDirectBroadcast =
        campaign.intent === "BROADCAST" && campaign.recipientEmails.length > 0;
      if (!isDirectBroadcast && !campaign.contactBookId) return;

      if (campaign.status === "PAUSED") return;

      if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now())
        return;

      if (campaign.status === "SCHEDULED") {
        await db.campaign.update({
          where: { id: campaignId },
          data: { status: "RUNNING" },
        });
        notifyCampaign(campaign, "started");
      }

      if (isDirectBroadcast) {
        const domain = await db.domain.findUnique({
          where: { id: campaign.domainId },
        });
        if (!domain) return;

        const alreadySent = new Set(
          (
            await db.campaignEmail.findMany({
              where: { campaignId: campaign.id },
              select: { contactId: true },
            })
          ).map((r) => r.contactId),
        );

        const remaining = campaign.recipientEmails.filter(
          (e) => !alreadySent.has(e),
        );

        if (remaining.length === 0) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: { status: "SENT" },
          });
          notifyCampaign(campaign, "completed");
          return;
        }

        const batchSize = campaign.batchSize ?? 500;
        const batch = remaining.slice(0, batchSize);

        for (const recipientEmail of batch) {
          const suppressed = await SuppressionService.checkMultipleEmails(
            [recipientEmail],
            campaign.teamId,
          );
          if (suppressed[recipientEmail]) {
            const email = await db.email.create({
              data: {
                to: [recipientEmail],
                from: campaign.from,
                subject: campaign.subject,
                html: campaign.html ?? "",
                teamId: campaign.teamId,
                campaignId: campaign.id,
                domainId: domain.id,
                latestStatus: "SUPPRESSED",
              },
            });
            await db.campaignEmail
              .create({
                data: {
                  campaignId: campaign.id,
                  contactId: recipientEmail,
                  emailId: email.id,
                },
              })
              .catch(() => { });
            continue;
          }

          const email = await db.email.create({
            data: {
              to: [recipientEmail],
              replyTo: Array.isArray(campaign.replyTo) ? campaign.replyTo : [],
              cc: Array.isArray(campaign.cc) ? campaign.cc : [],
              bcc: Array.isArray(campaign.bcc) ? campaign.bcc : [],
              from: campaign.from,
              subject: campaign.subject,
              html: campaign.html ?? "",
              text: campaign.previewText ?? undefined,
              teamId: campaign.teamId,
              campaignId: campaign.id,
              domainId: domain.id,
            },
          });

          await db.campaignEmail
            .create({
              data: {
                campaignId: campaign.id,
                contactId: recipientEmail,
                emailId: email.id,
              },
            })
            .catch(() => { });

          await EmailQueueService.queueEmail(
            email.id,
            campaign.teamId,
            domain.region,
            false,
          );
        }

        const newCursor = batch[batch.length - 1];
        await db.campaign.update({
          where: { id: campaign.id },
          data: { lastCursor: newCursor ?? null, lastSentAt: new Date() },
        });
        return;
      }

      const batchSize = campaign.batchSize ?? 500;

      const where = {
        contactBookId: campaign.contactBookId,
        subscribed: true,
      } as const;
      const pagination: any = {
        take: batchSize,
        orderBy: { id: "asc" as const },
      };
      if (campaign.lastCursor) {
        pagination.cursor = { id: campaign.lastCursor };
        pagination.skip = 1;
      }

      const contacts = await db.contact.findMany({ where, ...pagination });

      const contactBook = await db.contactBook.findUnique({
        where: { id: campaign.contactBookId },
        select: { variables: true },
      });

      const allowedVariables = [
        ...BUILT_IN_CONTACT_VARIABLES,
        ...(contactBook?.variables ?? []),
      ];

      if (contacts.length === 0) {
        await db.campaign.update({
          where: { id: campaignId },
          data: { status: "SENT" },
        });
        notifyCampaign(campaign, "completed");
        return;
      }

      const domain = await db.domain.findUnique({
        where: { id: campaign.domainId },
      });
      if (!domain) return;

      const existing = await db.campaignEmail.findMany({
        where: {
          campaignId: campaign.id,
          contactId: { in: contacts.map((c) => c.id) },
        },
        select: { contactId: true },
      });
      const existingSet = new Set(existing.map((e) => e.contactId));

      for (const contact of contacts) {
        if (existingSet.has(contact.id)) continue;

        await processContactEmail({
          contact,
          campaign,
          allowedVariables,
          emailConfig: {
            from: campaign.from,
            subject: campaign.subject,
            replyTo: Array.isArray(campaign.replyTo) ? campaign.replyTo : [],
            cc: Array.isArray(campaign.cc) ? campaign.cc : [],
            bcc: Array.isArray(campaign.bcc) ? campaign.bcc : [],
            teamId: campaign.teamId,
            campaignId: campaign.id,
            previewText: campaign.previewText ?? undefined,
            domainId: domain.id,
            region: domain.region,
          },
        });
      }

      const newCursor = contacts[contacts.length - 1]?.id;
      await db.campaign.update({
        where: { id: campaignId },
        data: { lastCursor: newCursor, lastSentAt: new Date() },
      });
    }),
    {
      connection: getRedis(),
      concurrency: 20,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  static async queueBatch({
    campaignId,
    teamId,
  }: {
    campaignId: string;
    teamId?: number;
  }) {
    try {
      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
        select: { lastSentAt: true, batchWindowMinutes: true, status: true },
      });
      if (!campaign) return;
      if (campaign.status === "PAUSED" || campaign.status === "SENT") return;
      const windowMin = campaign.batchWindowMinutes ?? 0;
      if (windowMin > 0 && campaign.lastSentAt) {
        const elapsedMs = Date.now() - new Date(campaign.lastSentAt).getTime();
        const windowMs = windowMin * 60 * 1000;
        if (elapsedMs < windowMs) {
          logger.debug(
            { campaignId, remainingMs: windowMs - elapsedMs },
            "Defensive skip enqueue; window not elapsed",
          );
          return;
        }
      }
    } catch (err) {
      logger.warn(
        { err, campaignId },
        "Failed defensive window check; proceeding to enqueue",
      );
    }

    await this.batchQueue.add(
      `campaign-${campaignId}`,
      { campaignId, teamId },
      { jobId: `campaign-batch:${campaignId}`, ...DEFAULT_QUEUE_OPTIONS },
    );
  }
}
