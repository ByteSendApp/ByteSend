import type { SesSetting } from "@prisma/client";
import { env } from "~/env";
import { db } from "../db";
import { getConfigurationSetEventDestinations } from "../aws/ses";
import { listTopicSubscriptions, subscribeEndpoint } from "../aws/sns";
import { logger } from "../logger/log";
import { SesCallbackTracker, type RejectedCallback } from "./ses-callback-tracker";
import { SesSettingsService } from "./ses-settings-service";

export type SubscriptionState = "confirmed" | "pending" | "missing" | "error";

export type ConfigSetDiagnosis = {
  name: string;
  ok: boolean;
  detail: string;
};

export type RegionCallbackDiagnosis = {
  settingId: string;
  region: string;
  topicArn: string | null;
  callbackUrl: string;
  expectedCallbackUrl: string;
  subscription: { state: SubscriptionState; endpoint: string | null; detail: string };
  configSets: ConfigSetDiagnosis[];
  lastReceivedAt: string | null;
  problems: string[];
};

export type CallbackDiagnostics = {
  regions: RegionCallbackDiagnosis[];
  lastRejected: RejectedCallback | null;
};

function expectedCallbackUrl() {
  return `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/ses_callback`;
}

function configSetNames(setting: SesSetting) {
  return [setting.configGeneral, setting.configClick, setting.configOpen, setting.configFull].filter(
    (name): name is string => Boolean(name),
  );
}

async function diagnoseSubscription(setting: SesSetting): Promise<RegionCallbackDiagnosis["subscription"]> {
  if (!setting.topicArn) {
    return { state: "missing", endpoint: null, detail: "No SNS topic is stored for this region" };
  }
  try {
    const subscriptions = await listTopicSubscriptions(setting.topicArn, setting.region);
    const ours = subscriptions.find((subscription) => subscription.endpoint === setting.callbackUrl);
    if (!ours) {
      const others = subscriptions.map((subscription) => subscription.endpoint).filter(Boolean).join(", ");
      return {
        state: "missing",
        endpoint: null,
        detail: others
          ? `The topic is subscribed to ${others}, not ${setting.callbackUrl}`
          : "The topic has no subscriptions, so SES events go nowhere",
      };
    }
    if (ours.subscriptionArn === "PendingConfirmation") {
      return {
        state: "pending",
        endpoint: ours.endpoint,
        detail: "AWS is still waiting for this endpoint to confirm the subscription",
      };
    }
    return { state: "confirmed", endpoint: ours.endpoint, detail: "Confirmed" };
  } catch (error) {
    logger.warn({ err: error, region: setting.region }, "[SesCallbackDiagnostics]: SNS lookup failed");
    return {
      state: "error",
      endpoint: null,
      detail: error instanceof Error ? error.message : "Could not read the SNS topic",
    };
  }
}

async function diagnoseConfigSet(setting: SesSetting, name: string): Promise<ConfigSetDiagnosis> {
  try {
    const destinations = await getConfigurationSetEventDestinations(name, setting.region);
    const destination = destinations.find((candidate) => candidate.topicArn === setting.topicArn);
    if (!destination) {
      return { name, ok: false, detail: "No event destination points at this region's SNS topic" };
    }
    if (!destination.enabled) {
      return { name, ok: false, detail: "The event destination is disabled" };
    }
    if (!destination.eventTypes.includes("DELIVERY")) {
      return { name, ok: false, detail: "The event destination doesn't publish DELIVERY events" };
    }
    return { name, ok: true, detail: destination.eventTypes.join(", ") };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : "Could not read the configuration set" };
  }
}

async function diagnoseRegion(setting: SesSetting): Promise<RegionCallbackDiagnosis> {
  const expected = expectedCallbackUrl();
  const [subscription, configSets, lastReceivedAt] = await Promise.all([
    diagnoseSubscription(setting),
    Promise.all(configSetNames(setting).map((name) => diagnoseConfigSet(setting, name))),
    setting.topicArn ? SesCallbackTracker.lastReceived(setting.topicArn) : Promise.resolve(null),
  ]);

  const problems: string[] = [];
  if (setting.callbackUrl !== expected) {
    problems.push(`The callback URL is ${setting.callbackUrl}, but this site is served from ${expected}`);
  }
  if (subscription.state !== "confirmed") problems.push(subscription.detail);
  if (configSets.length === 0) problems.push("No configuration sets are stored for this region");
  for (const configSet of configSets.filter((candidate) => !candidate.ok)) {
    problems.push(`${configSet.name}: ${configSet.detail}`);
  }

  return {
    settingId: setting.id,
    region: setting.region,
    topicArn: setting.topicArn,
    callbackUrl: setting.callbackUrl,
    expectedCallbackUrl: expected,
    subscription,
    configSets,
    lastReceivedAt,
    problems,
  };
}

export const SesCallbackDiagnosticsService = {
  async diagnose(): Promise<CallbackDiagnostics> {
    const settings = await SesSettingsService.getAllSettings();
    const [regions, lastRejected] = await Promise.all([
      Promise.all(settings.map(diagnoseRegion)),
      SesCallbackTracker.lastRejected(),
    ]);
    return { regions, lastRejected };
  },

  /**
   * Points the region's callback at this site's URL and (re)subscribes it to the SNS topic.
   * SNS then sends a SubscriptionConfirmation, which /api/ses_callback confirms automatically.
   */
  async resubscribe(settingId: string) {
    const setting = await db.sesSetting.findUnique({ where: { id: settingId } });
    if (!setting?.topicArn) throw new Error("SES setting or SNS topic not found");

    const callbackUrl = expectedCallbackUrl();
    if (setting.callbackUrl !== callbackUrl) {
      await db.sesSetting.update({
        where: { id: setting.id },
        data: { callbackUrl, callbackSuccess: false },
      });
      await SesSettingsService.invalidateCache();
    }

    const subscriptionArn = await subscribeEndpoint(setting.topicArn, callbackUrl, setting.region);
    return { previousCallbackUrl: setting.callbackUrl, callbackUrl, subscriptionArn: subscriptionArn ?? null };
  },
};
