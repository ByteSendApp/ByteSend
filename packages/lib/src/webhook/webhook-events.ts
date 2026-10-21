export const ContactEvents = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
] as const;

export type ContactWebhookEventType = (typeof ContactEvents)[number];

export const DomainEvents = [
  "domain.created",
  "domain.verified",
  "domain.updated",
  "domain.deleted",
] as const;

export type DomainWebhookEventType = (typeof DomainEvents)[number];

export const EmailEvents = [
  "email.queued",
  "email.sent",
  "email.delivery_delayed",
  "email.delivered",
  "email.bounced",
  "email.rejected",
  "email.rendering_failure",
  "email.complained",
  "email.failed",
  "email.cancelled",
  "email.suppressed",
  "email.opened",
  "email.clicked",
] as const;

export type EmailWebhookEventType = (typeof EmailEvents)[number];

export const InboundEvents = ["email.received"] as const;

export type InboundWebhookEventType = (typeof InboundEvents)[number];

export const WebhookTestEvents = ["webhook.test"] as const;

export type WebhookTestEventType = (typeof WebhookTestEvents)[number];

export const WebhookEvents = [
  ...ContactEvents,
  ...DomainEvents,
  ...EmailEvents,
  ...InboundEvents,
  ...WebhookTestEvents,
] as const;

export type WebhookEventType = (typeof WebhookEvents)[number];

export type EmailStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERY_DELAYED"
  | "DELIVERED"
  | "BOUNCED"
  | "REJECTED"
  | "RENDERING_FAILURE"
  | "COMPLAINED"
  | "FAILED"
  | "CANCELLED"
  | "SUPPRESSED"
  | "HELD"
  | "OPENED"
  | "CLICKED"
  | "SCHEDULED";

export type EmailBasePayload = {
  id: string;
  status: EmailStatus;
  from: string;
  to: Array<string>;
  occurredAt: string;
  campaignId?: string | null;
  contactId?: string | null;
  domainId?: number | null;
  subject?: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
  test?: boolean;
};

export type ContactPayload = {
  id: string;
  email: string;
  contactBookId: string;
  subscribed: boolean;
  properties: Record<string, unknown>;
  firstName?: string | null;
  lastName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DomainPayload = {
  id: number;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  clickTracking: boolean;
  openTracking: boolean;
  subdomain?: string | null;
  sesTenantId?: string | null;
  dkimStatus?: string | null;
  spfDetails?: string | null;
  dmarcAdded?: boolean | null;
};

export type EmailBouncedPayload = EmailBasePayload & {
  bounce: {
    type: "Transient" | "Permanent" | "Undetermined";
    subType:
      | "General"
      | "NoEmail"
      | "Suppressed"
      | "OnAccountSuppressionList"
      | "MailboxFull"
      | "MessageTooLarge"
      | "ContentRejected"
      | "AttachmentRejected";
    message?: string;
  };
};

export type EmailFailedPayload = EmailBasePayload & {
  failed: {
    reason: string;
  };
};

export type EmailSuppressedPayload = EmailBasePayload & {
  suppression: {
    type: "Bounce" | "Complaint" | "Manual";
    reason: string;
    source?: string;
  };
};

export type EmailOpenedPayload = EmailBasePayload & {
  open: {
    timestamp: string;
    userAgent?: string;
    ip?: string;
    platform?: string;
  };
};

export type EmailClickedPayload = EmailBasePayload & {
  click: {
    timestamp: string;
    url: string;
    userAgent?: string;
    ip?: string;
    platform?: string;
  };
};

export type InboundAttachmentPayload = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
};

export type EmailReceivedPayload = {
  id: string;
  recipient: string;
  from: string;
  fromName?: string | null;
  to: string[];
  cc: string[];
  replyTo: string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  inReplyToEmailId?: string | null;
  attachments: InboundAttachmentPayload[];
  authentication: { spf?: string | null; dkim?: string | null; dmarc?: string | null; spam?: string | null; virus?: string | null };
  domainId?: number | null;
  receivedAt: string;
};

export type WebhookTestPayload = {
  test: boolean;
  webhookId: string;
  sentAt: string;
};

export type EmailEventPayloadMap = {
  "email.queued": EmailBasePayload;
  "email.sent": EmailBasePayload;
  "email.delivery_delayed": EmailBasePayload;
  "email.delivered": EmailBasePayload;
  "email.bounced": EmailBouncedPayload;
  "email.rejected": EmailBasePayload;
  "email.rendering_failure": EmailBasePayload;
  "email.complained": EmailBasePayload;
  "email.failed": EmailFailedPayload;
  "email.cancelled": EmailBasePayload;
  "email.suppressed": EmailSuppressedPayload;
  "email.opened": EmailOpenedPayload;
  "email.clicked": EmailClickedPayload;
};

export type DomainEventPayloadMap = {
  "domain.created": DomainPayload;
  "domain.verified": DomainPayload;
  "domain.updated": DomainPayload;
  "domain.deleted": DomainPayload;
};

export type ContactEventPayloadMap = {
  "contact.created": ContactPayload;
  "contact.updated": ContactPayload;
  "contact.deleted": ContactPayload;
};

export type InboundEventPayloadMap = {
  "email.received": EmailReceivedPayload;
};

export type WebhookTestEventPayloadMap = {
  "webhook.test": WebhookTestPayload;
};

export type WebhookEventPayloadMap = EmailEventPayloadMap &
  DomainEventPayloadMap &
  ContactEventPayloadMap &
  InboundEventPayloadMap &
  WebhookTestEventPayloadMap;

export type WebhookPayloadData<TType extends WebhookEventType> =
  WebhookEventPayloadMap[TType];

export type WebhookEvent<TType extends WebhookEventType> = {
  id: string;
  type: TType;
  createdAt: string;
  data: WebhookPayloadData<TType>;
};

export type WebhookEventData = {
  [T in WebhookEventType]: WebhookEvent<T>;
}[WebhookEventType];

export const WEBHOOK_EVENT_VERSION = "2026-01-18";
