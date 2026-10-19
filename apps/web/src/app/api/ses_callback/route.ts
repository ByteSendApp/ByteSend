import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { parseSesHook, SesHookParser } from "~/server/service/ses-hook-parser";
import { SesCallbackTracker } from "~/server/service/ses-callback-tracker";
import { SesSettingsService } from "~/server/service/ses-settings-service";
import { SnsNotificationMessage } from "~/types/aws-types";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ data: "Hello" });
}

export async function POST(req: Request) {
  const data = await req.json();

  logger.debug(
    {
      type: data?.Type,
      topicArn: data?.TopicArn,
      messageId: data?.MessageId,
      hasMessage: typeof data?.Message === "string",
    },
    "Received SES callback payload",
  );

  const trustedTopicArn = await getTrustedTopicArn(data?.TopicArn);
  const isEventValid = trustedTopicArn !== null;

  logger.debug({ isEventValid }, "SES callback topic validation result");

  if (!isEventValid) {
    if (typeof data?.TopicArn === "string") {
      await SesCallbackTracker.recordRejected(data.TopicArn);
    }
    return Response.json({ data: "Event is not valid" });
  }

  await SesCallbackTracker.recordReceived(trustedTopicArn);

  if (data.Type === "SubscriptionConfirmation") {
    return handleSubscription(data, trustedTopicArn);
  }

  let message = null;

  try {
    message = JSON.parse(data.Message || "{}");
    const status = await SesHookParser.queue({
      event: message,
      messageId: data.MessageId,
    });
    if (!status) {
      return Response.json({ data: "Error in parsing hook" });
    }

    return Response.json({ data: "Success" });
  } catch (e) {
    logger.error(
      { error: e instanceof Error ? e.message : "Unknown error" },
      "Failed to parse SES callback message",
    );
    return Response.json({ data: "Error is parsing hook" });
  }
}

/**
 * Handles the subscription confirmation event. called only once for a webhook
 */
async function handleSubscription(
  message: { Token?: string },
  trustedTopicArn: string,
) {
  const subscribeUrl = buildSnsSubscribeConfirmUrl(trustedTopicArn, message.Token);

  await fetch(subscribeUrl, {
    method: "GET",
  });

  const setting = await db.sesSetting.findFirst({
    where: {
      topicArn: trustedTopicArn,
    },
  });

  if (!setting) {
    return Response.json({ data: "Setting not found" });
  }

  await db.sesSetting.update({
    where: {
      id: setting?.id,
    },
    data: {
      callbackSuccess: true,
    },
  });

  SesSettingsService.invalidateCache();

  return Response.json({ data: "Success" });
}

/**
 * Build a trusted SNS subscription confirmation URL from message fields.
 * We intentionally do not use message.SubscribeURL directly to prevent SSRF.
 */
function buildSnsSubscribeConfirmUrl(topicArn: string, token?: string) {

  if (!token) {
    throw new Error("Invalid SNS subscription payload");
  }

  const arnParts = topicArn.split(":");
  if (arnParts.length < 6 || arnParts[2] !== "sns") {
    throw new Error("Invalid SNS TopicArn");
  }

  const partition = arnParts[1];
  const region = arnParts[3];

  if (!region) {
    throw new Error("SNS TopicArn is missing region");
  }

  const domain = partition === "aws-cn" ? "amazonaws.com.cn" : "amazonaws.com";
  const confirmUrl = new URL(`https://sns.${region}.${domain}/`);
  confirmUrl.searchParams.set("Action", "ConfirmSubscription");
  confirmUrl.searchParams.set("TopicArn", topicArn);
  confirmUrl.searchParams.set("Token", token);

  return confirmUrl.toString();
}

/**
 * Returns an exact TopicArn from server configuration if input matches.
 * This keeps downstream URL construction anchored to trusted configuration.
 */
async function getTrustedTopicArn(topicArn: SnsNotificationMessage["TopicArn"]) {
  if (!topicArn || typeof topicArn !== "string") {
    return null;
  }

  const configuredTopicArns = await SesSettingsService.getTopicArns();
  const trustedTopicArn = configuredTopicArns.find((configured) => configured === topicArn);

  if (trustedTopicArn) {
    return trustedTopicArn;
  }

  // SNS treats our 200 response as delivered and never retries, so a mismatch silently drops every
  // SES event (statuses stay QUEUED, bounces aren't suppressed). Always log it.
  logger.warn(
    { topicArn, configuredTopicArns },
    "[SesCallback]: Rejected SNS message from a TopicArn that matches no SES setting",
  );

  return null;
}
