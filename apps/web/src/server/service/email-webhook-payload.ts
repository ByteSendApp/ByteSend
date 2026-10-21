import { EmailStatus, type Email } from "@prisma/client";
import {
  type EmailBasePayload,
  type EmailEventPayloadMap,
  type EmailWebhookEventType,
} from "@bytesend/lib/src/webhook/webhook-events";
import { SesBounce, SesClick, SesEvent, SesEventDataKey } from "~/types/aws-types";

type EmailBounceSubType =
  EmailEventPayloadMap["email.bounced"]["bounce"]["subType"];

export function buildEmailWebhookPayload(params: {
  email: Email;
  status: EmailStatus;
  occurredAt: string;
  eventData: SesEvent | SesEvent[SesEventDataKey];
  metadata?: Record<string, unknown>;
}): EmailEventPayloadMap[EmailWebhookEventType] {
  const { email, status, eventData, occurredAt, metadata } = params;

  const basePayload: EmailBasePayload = {
    id: email.id,
    status,
    from: email.from,
    to: email.to,
    occurredAt,
    campaignId: email.campaignId ?? undefined,
    contactId: email.contactId ?? undefined,
    domainId: email.domainId ?? null,
    subject: email.subject,
    metadata,
    ...(email.isTest ? { test: true } : {}),
  };

  switch (status) {
    case EmailStatus.BOUNCED: {
      const bounce = eventData as SesBounce | undefined;
      return {
        ...basePayload,
        bounce: {
          type: bounce?.bounceType ?? "Undetermined",
          subType: normalizeBounceSubType(bounce?.bounceSubType),
          message: bounce?.bouncedRecipients?.[0]?.diagnosticCode,
        },
      };
    }
    case EmailStatus.OPENED: {
      const openData = eventData as SesEvent["open"];
      return {
        ...basePayload,
        open: {
          timestamp: openData?.timestamp ?? occurredAt,
          userAgent: openData?.userAgent,
          ip: openData?.ipAddress,
        },
      };
    }
    case EmailStatus.CLICKED: {
      const clickData = eventData as SesClick | undefined;
      return {
        ...basePayload,
        click: {
          timestamp: clickData?.timestamp ?? occurredAt,
          url: clickData?.link ?? "",
          userAgent: clickData?.userAgent,
          ip: clickData?.ipAddress,
        },
      };
    }
    default:
      return basePayload;
  }
}

function normalizeBounceSubType(
  subType: SesBounce["bounceSubType"] | undefined,
): EmailBounceSubType {
  const normalized = subType?.replace(/\s+/g, "") as
    | EmailBounceSubType
    | undefined;

  const validSubTypes: EmailBounceSubType[] = [
    "General",
    "NoEmail",
    "Suppressed",
    "OnAccountSuppressionList",
    "MailboxFull",
    "MessageTooLarge",
    "ContentRejected",
    "AttachmentRejected",
  ];

  if (normalized && validSubTypes.includes(normalized)) {
    return normalized;
  }

  return "General";
}

export function emailStatusToEvent(status: EmailStatus): EmailWebhookEventType {
  switch (status) {
    case EmailStatus.QUEUED:
      return "email.queued";
    case EmailStatus.SENT:
      return "email.sent";
    case EmailStatus.DELIVERY_DELAYED:
      return "email.delivery_delayed";
    case EmailStatus.DELIVERED:
      return "email.delivered";
    case EmailStatus.BOUNCED:
      return "email.bounced";
    case EmailStatus.REJECTED:
      return "email.rejected";
    case EmailStatus.RENDERING_FAILURE:
      return "email.rendering_failure";
    case EmailStatus.COMPLAINED:
      return "email.complained";
    case EmailStatus.FAILED:
      return "email.failed";
    case EmailStatus.CANCELLED:
      return "email.cancelled";
    case EmailStatus.SUPPRESSED:
      return "email.suppressed";
    case EmailStatus.OPENED:
      return "email.opened";
    case EmailStatus.CLICKED:
      return "email.clicked";
    default:
      return "email.queued";
  }
}
