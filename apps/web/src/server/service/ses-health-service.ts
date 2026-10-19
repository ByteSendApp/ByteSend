import { getAccount } from "../aws/ses";
import { logger } from "../logger/log";
import { SesSettingsService } from "./ses-settings-service";

// Status monitors poll every minute; caching keeps public traffic from turning into AWS API calls.
const CACHE_TTL_MS = 60_000;
const QUOTA_WARNING_RATIO = 0.9;

export type SesHealthStatus = "operational" | "degraded" | "down";

export type SesRegionHealth = {
  region: string;
  status: SesHealthStatus;
  checkedAt: string;
  reasons: string[];
  details: {
    sendingEnabled: boolean | null;
    productionAccessEnabled: boolean | null;
    enforcementStatus: string | null;
    sentLast24Hours: number | null;
    max24HourSend: number | null;
  };
};

const cache = new Map<string, { value: SesRegionHealth; expiresAt: number }>();

export function classifySesAccount(account: {
  SendingEnabled?: boolean;
  ProductionAccessEnabled?: boolean;
  EnforcementStatus?: string;
  SendQuota?: { SentLast24Hours?: number; Max24HourSend?: number };
}): { status: SesHealthStatus; reasons: string[] } {
  const reasons: string[] = [];
  let status: SesHealthStatus = "operational";

  const enforcement = account.EnforcementStatus?.toUpperCase();
  if (account.SendingEnabled === false) {
    status = "down";
    reasons.push("Sending is disabled for this region");
  }
  if (enforcement === "SHUTDOWN") {
    status = "down";
    reasons.push("AWS has shut down sending for this account");
  } else if (enforcement && enforcement !== "HEALTHY") {
    if (status !== "down") status = "degraded";
    reasons.push(`Account enforcement status is ${enforcement.toLowerCase()}`);
  }
  if (account.ProductionAccessEnabled === false) {
    if (status !== "down") status = "degraded";
    reasons.push("Region is in the SES sandbox");
  }

  const sent = account.SendQuota?.SentLast24Hours;
  const max = account.SendQuota?.Max24HourSend;
  if (sent !== undefined && max !== undefined && max > 0 && sent / max >= QUOTA_WARNING_RATIO) {
    if (status !== "down") status = "degraded";
    reasons.push("Over 90% of the 24-hour sending quota is used");
  }

  return { status, reasons };
}

export class SesHealthService {
  static async listRegions() {
    const settings = await SesSettingsService.getAllSettings();
    return settings.filter((setting) => setting.isActive).map((setting) => setting.region);
  }

  static async check(region: string): Promise<SesRegionHealth> {
    const cached = cache.get(region);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let value: SesRegionHealth;
    try {
      const account = await getAccount(region);
      const { status, reasons } = classifySesAccount({
        SendingEnabled: account.SendingEnabled,
        ProductionAccessEnabled: account.ProductionAccessEnabled,
        EnforcementStatus: account.EnforcementStatus,
        SendQuota: account.SendQuota,
      });
      value = {
        region,
        status,
        reasons,
        checkedAt: new Date().toISOString(),
        details: {
          sendingEnabled: account.SendingEnabled ?? null,
          productionAccessEnabled: account.ProductionAccessEnabled ?? null,
          enforcementStatus: account.EnforcementStatus ?? null,
          sentLast24Hours: account.SendQuota?.SentLast24Hours ?? null,
          max24HourSend: account.SendQuota?.Max24HourSend ?? null,
        },
      };
    } catch (error) {
      logger.error({ err: error, region }, "[SesHealthService]: SES account check failed");
      value = {
        region,
        status: "down",
        reasons: ["SES could not be reached"],
        checkedAt: new Date().toISOString(),
        details: {
          sendingEnabled: null,
          productionAccessEnabled: null,
          enforcementStatus: null,
          sentLast24Hours: null,
          max24HourSend: null,
        },
      };
    }

    cache.set(region, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }
}
