import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, state, type CapturedMessage, type Outcome } from "./store.ts";

// The app usually subscribes with a localhost URL. Inside Docker that's the container itself, so it's
// rewritten to reach the host (set LOCALHOST_ALIAS=host.docker.internal in compose).
const LOCALHOST_ALIAS = process.env.LOCALHOST_ALIAS;
const FALLBACK_WEBHOOK_URL = process.env.WEBHOOK_URL;
const DELIVERY_DELAY_MS = Number(process.env.DELIVERY_DELAY_MS ?? 800);

export function reachable(url: string) {
  if (!LOCALHOST_ALIAS) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") parsed.hostname = LOCALHOST_ALIAS;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Picks what happens to a message from its recipients, following SES's mailbox simulator
 * (bounce@simulator.amazonses.com and friends) plus `+bounce` / `+complaint` tags on any address.
 */
export function outcomeFor(recipients: string[]): Outcome {
  const lower = recipients.map((r) => r.toLowerCase());
  const has = (local: string) =>
    lower.some((r) => r === `${local}@simulator.amazonses.com` || r.split("@")[0]?.endsWith(`+${local}`));
  if (has("suppressionlist")) return "suppressed";
  if (has("bounce")) return "bounced";
  if (has("complaint")) return "complained";
  return "delivered";
}

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(reachable(url), {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=UTF-8", "x-amz-sns-message-type": (body as { Type: string }).Type },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn(`[local-ses-sns] ${url} answered ${res.status}`);
  } catch (error) {
    console.warn(`[local-ses-sns] couldn't reach ${url}: ${(error as Error).message}`);
  }
}

export async function publish(topicArn: string, message: unknown) {
  const endpoints = state.subscriptions.filter((s) => s.topicArn === topicArn && s.protocol.startsWith("http")).map((s) => s.endpoint);
  if (endpoints.length === 0 && FALLBACK_WEBHOOK_URL) endpoints.push(FALLBACK_WEBHOOK_URL);
  const envelope = {
    Type: "Notification",
    MessageId: randomUUID(),
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1",
    Signature: "local",
    SigningCertURL: "",
    UnsubscribeURL: "",
  };
  await Promise.all(endpoints.map((endpoint) => post(endpoint, envelope)));
}

export function confirmSubscription(topicArn: string, endpoint: string) {
  const token = randomUUID().replace(/-/g, "");
  // Sent a moment later so the app has saved the topic before the confirmation reaches it.
  setTimeout(() => {
    void post(endpoint, {
      Type: "SubscriptionConfirmation",
      MessageId: randomUUID(),
      Token: token,
      TopicArn: topicArn,
      Message: `You have chosen to subscribe to the topic ${topicArn}.`,
      SubscribeURL: "",
      Timestamp: new Date().toISOString(),
      SignatureVersion: "1",
      Signature: "local",
      SigningCertURL: "",
    });
  }, 1500);
}

function sesEvent(eventType: string, message: CapturedMessage, tags: Record<string, string[]>, detail: Record<string, unknown>) {
  const subjectHeader = { name: "Subject", value: message.subject };
  return {
    eventType,
    mail: {
      timestamp: message.receivedAt,
      source: message.from,
      sourceArn: `arn:aws:ses:${message.region}:${ACCOUNT_ID}:identity/${message.from.split("@")[1] ?? ""}`,
      sendingAccountId: ACCOUNT_ID,
      messageId: message.id,
      destination: message.to,
      headersTruncated: false,
      headers: message.headers.length ? message.headers : [subjectHeader],
      commonHeaders: { from: [message.from], to: message.to, messageId: message.id, subject: message.subject },
      tags,
    },
    ...detail,
  };
}

/** Sends the events SES would publish for this message: Send straight away, then the outcome. */
export function emitEvents(message: CapturedMessage, topicArns: Array<{ arn: string; types: string[] }>, tags: Record<string, string[]>) {
  if (topicArns.length === 0 && !FALLBACK_WEBHOOK_URL) return;
  const targets = topicArns.length ? topicArns : [{ arn: "local", types: [] }];
  const emit = (type: string, detail: Record<string, unknown>) => {
    for (const target of targets) {
      if (target.types.length && !target.types.some((t) => t.toUpperCase() === type.toUpperCase())) continue;
      void publish(target.arn, sesEvent(type, message, tags, detail));
    }
  };

  const timestamp = () => new Date().toISOString();
  const feedbackId = () => `${Date.now().toString(16)}-${randomUUID()}`;

  setTimeout(() => emit("Send", { send: {} }), 100);
  setTimeout(() => {
    switch (message.outcome) {
      case "bounced":
      case "suppressed":
        emit("Bounce", {
          bounce: {
            bounceType: "Permanent",
            bounceSubType: message.outcome === "suppressed" ? "OnAccountSuppressionList" : "General",
            bouncedRecipients: message.to.map((emailAddress) => ({
              emailAddress,
              action: "failed",
              status: "5.1.1",
              diagnosticCode: "smtp; 550 5.1.1 user unknown",
            })),
            timestamp: timestamp(),
            feedbackId: feedbackId(),
            reportingMTA: "dns; local-ses-sns",
          },
        });
        break;
      case "complained":
        emit("Delivery", { delivery: { timestamp: timestamp(), processingTimeMillis: DELIVERY_DELAY_MS, recipients: message.to, smtpResponse: "250 2.0.0 OK", reportingMTA: "local-ses-sns" } });
        setTimeout(
          () =>
            emit("Complaint", {
              complaint: {
                complainedRecipients: message.to.map((emailAddress) => ({ emailAddress })),
                timestamp: timestamp(),
                feedbackId: feedbackId(),
                complaintFeedbackType: "abuse",
              },
            }),
          DELIVERY_DELAY_MS,
        );
        break;
      default:
        emit("Delivery", { delivery: { timestamp: timestamp(), processingTimeMillis: DELIVERY_DELAY_MS, recipients: message.to, smtpResponse: "250 2.0.0 OK", reportingMTA: "local-ses-sns" } });
    }
  }, DELIVERY_DELAY_MS);
}
