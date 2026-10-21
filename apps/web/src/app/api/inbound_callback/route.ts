import { env } from "~/env";
import { logger } from "~/server/logger/log";
import { enqueueInbound } from "~/server/jobs/inbound-job";
import { isInboundEnabled } from "~/server/service/inbound-storage";
import type { SesInboundNotification } from "~/server/service/inbound-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isInboundEnabled()) return Response.json({ data: "Inbound email is off" }, { status: 404 });

  const data = (await req.json()) as { Type?: string; TopicArn?: string; Message?: string; Token?: string };
  if (!env.INBOUND_SNS_TOPIC_ARN || data.TopicArn !== env.INBOUND_SNS_TOPIC_ARN) {
    logger.warn({ topicArn: data.TopicArn }, "[InboundCallback]: Rejected message from an unexpected topic");
    return Response.json({ data: "Unknown topic" }, { status: 403 });
  }

  if (data.Type === "SubscriptionConfirmation") {
    await confirmSubscription(env.INBOUND_SNS_TOPIC_ARN, data.Token);
    return Response.json({ data: "Subscribed" });
  }

  if (data.Type !== "Notification" || !data.Message) return Response.json({ data: "Ignored" });

  let notification: SesInboundNotification;
  try {
    notification = JSON.parse(data.Message) as SesInboundNotification;
  } catch {
    return Response.json({ data: "Invalid message" }, { status: 400 });
  }
  if (notification.notificationType !== "Received") return Response.json({ data: "Ignored" });

  await enqueueInbound(notification);
  logger.info({ sesId: notification.mail?.messageId, recipients: notification.receipt?.recipients }, "[InboundCallback]: Queued received mail");
  return Response.json({ data: "Queued" });
}

async function confirmSubscription(topicArn: string, token?: string) {
  if (!token) return;
  const region = topicArn.split(":")[3];
  const url = new URL(`https://sns.${region}.amazonaws.com/`);
  url.searchParams.set("Action", "ConfirmSubscription");
  url.searchParams.set("TopicArn", topicArn);
  url.searchParams.set("Token", token);
  try {
    const response = await fetch(url, { method: "GET" });
    logger.info({ topicArn, status: response.status }, "[InboundCallback]: Confirmed the SNS subscription");
  } catch (error) {
    logger.warn({ err: error }, "[InboundCallback]: Couldn't confirm the SNS subscription");
  }
}
