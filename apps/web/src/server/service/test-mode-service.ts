import { Prisma, type Email, type EmailStatus } from "@prisma/client";
import { db } from "../db";
import { logger } from "../logger/log";
import { ByteSendApiError } from "../public-api/api-error";
import { WebhookService } from "./webhook-service";
import { buildEmailWebhookPayload, emailStatusToEvent } from "./email-webhook-payload";

export const TEST_EMAILS_PER_DAY = 1_000;

export type TestOutcome = "delivered" | "bounced" | "complained";

export function simulatedOutcome(to: string[]): TestOutcome {
  const local = (to[0] ?? "").toLowerCase().split("@")[0] ?? "";
  if (local.includes("bounce")) return "bounced";
  if (local.includes("complain")) return "complained";
  return "delivered";
}

export async function assertTestAllowance(teamId: number, adding = 1) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sent = await db.email.count({ where: { teamId, isTest: true, createdAt: { gte: since } } });
  if (sent + adding > TEST_EMAILS_PER_DAY) {
    throw new ByteSendApiError({
      code: "RATE_LIMITED",
      message: `Test keys can send ${TEST_EMAILS_PER_DAY.toLocaleString("en-US")} emails a day. Try again later or use a live key.`,
    });
  }
}

async function recordEvent(email: Email, status: EmailStatus, data: Record<string, unknown>) {
  const occurredAt = new Date().toISOString();
  await db.email.update({ where: { id: email.id }, data: { latestStatus: status } });
  await db.emailEvent.create({
    data: { emailId: email.id, status, data: { ...data, timestamp: occurredAt, simulated: true } as Prisma.InputJsonValue, teamId: email.teamId },
  });
  try {
    await WebhookService.emit(
      email.teamId,
      emailStatusToEvent(status),
      buildEmailWebhookPayload({ email, status, occurredAt, eventData: data as never }),
      { domainId: email.domainId ?? null },
    );
  } catch (error) {
    logger.error({ err: error, emailId: email.id, status }, "[TestMode]: Failed to emit webhook");
  }
}

export async function simulateTestEmail(email: Email) {
  const { count } = await db.email.updateMany({
    where: { id: email.id, latestStatus: { in: ["QUEUED", "SCHEDULED"] } },
    data: { latestStatus: "SENT", attachments: null, headers: null },
  });
  if (count === 0) return;

  const recipient = email.to[0] ?? "";
  await recordEvent(email, "SENT", {});

  const outcome = simulatedOutcome(email.to);
  if (outcome === "bounced") {
    await recordEvent(email, "BOUNCED", {
      bounceType: "Permanent",
      bounceSubType: "General",
      bouncedRecipients: [{ emailAddress: recipient, action: "failed", status: "5.1.1", diagnosticCode: "smtp; 550 5.1.1 user unknown (simulated)" }],
    });
    return;
  }

  await recordEvent(email, "DELIVERED", { recipients: email.to, smtpResponse: "250 2.0.0 OK (simulated)" });
  if (outcome === "complained") {
    await recordEvent(email, "COMPLAINED", { complainedRecipients: [{ emailAddress: recipient }], complaintFeedbackType: "abuse" });
  }
  logger.info({ emailId: email.id, outcome }, "[TestMode]: Simulated delivery");
}
