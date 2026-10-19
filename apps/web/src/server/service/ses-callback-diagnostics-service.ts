import type { SesSetting } from "@prisma/client";
import { env } from "~/env";
import { db } from "../db";
import type { EventType } from "@aws-sdk/client-sesv2";
import { getConfigurationSetEventDestinations, repairConfigurationSetEventDestination } from "../aws/ses";
import { listTopicSubscriptions, subscribeEndpoint } from "../aws/sns";
import { logger } from "../logger/log";
import { SesCallbackTracker, type RejectedCallback } from "./ses-callback-tracker";
import { GENERAL_EVENTS, SesSettingsService } from "./ses-settings-service";

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

type ConfigSet = { name: string; eventTypes: EventType[] };

// Mirrors the event types each configuration set is created with in SesSettingsService.
function configSetsFor(setting: SesSetting): ConfigSet[] {
  return [
    { name: setting.configGeneral, eventTypes: GENERAL_EVENTS },
    { name: setting.configClick, eventTypes: [...GENERAL_EVENTS, "CLICK"] },
    { name: setting.configOpen, eventTypes: [...GENERAL_EVENTS, "OPEN"] },
    { name: setting.configFull, eventTypes: [...GENERAL_EVENTS, "CLICK", "OPEN"] },
  ].filter((configSet): configSet is ConfigSet => Boolean(configSet.name));
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

async function diagnoseConfigSet(setting: SesSetting, { name, eventTypes }: ConfigSet): Promise<ConfigSetDiagnosis> {
  try {
    const destinations = await getConfigurationSetEventDestinations(name, setting.region);
    const destination = destinations.find((candidate) => candidate.topicArn === setting.topicArn);
    if (!destination) {
      return { name, ok: false, detail: "No event destination points at this region's SNS topic" };
    }
    if (!destination.enabled) {
      return { name, ok: false, detail: "The event destination is disabled" };
    }
    const missing = eventTypes.filter((eventType) => !destination.eventTypes.includes(eventType));
    if (missing.length > 0) {
      return { name, ok: false, detail: `The event destination doesn't publish ${missing.join(", ")}` };
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
    Promise.all(configSetsFor(setting).map((configSet) => diagnoseConfigSet(setting, configSet))),
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
   * Fixes whatever diagnose() flags for a region: points the callback at this site and resubscribes
   * it (SNS then sends a SubscriptionConfirmation that /api/ses_callback confirms), and re-enables or
   * re-points any configuration set event destination that isn't publishing to the region's topic.
   */
  async repair(settingId: string) {
    const setting = await db.sesSetting.findUnique({ where: { id: settingId } });
    if (!setting?.topicArn) throw new Error("SES setting or SNS topic not found");

    const callbackUrl = expectedCallbackUrl();
    const actions: string[] = [];

    if (setting.callbackUrl !== callbackUrl) {
      await db.sesSetting.update({
        where: { id: setting.id },
        data: { callbackUrl, callbackSuccess: false },
      });
      await SesSettingsService.invalidateCache();
      actions.push(`Callback URL changed from ${setting.callbackUrl} to ${callbackUrl}`);
    }

    const subscription = await diagnoseSubscription({ ...setting, callbackUrl });
    if (subscription.state !== "confirmed") {
      await subscribeEndpoint(setting.topicArn, callbackUrl, setting.region);
      actions.push(`Subscribed ${callbackUrl} to the SNS topic`);
    }

    for (const configSet of configSetsFor(setting)) {
      const diagnosis = await diagnoseConfigSet(setting, configSet);
      if (diagnosis.ok) continue;
      await repairConfigurationSetEventDestination(configSet.name, setting.topicArn, configSet.eventTypes, setting.region);
      actions.push(`Repaired ${configSet.name} (${diagnosis.detail})`);
    }

    return { actions };
  },
};
