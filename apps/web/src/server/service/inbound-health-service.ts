import { env } from "~/env";
import { logger } from "../logger/log";
import { withCache } from "../redis";
import { getReceivingRuleState } from "../aws/ses-receiving";
import { getInboundQueueCounts } from "../jobs/inbound-job";
import { INBOUND_CANARY_INTERVAL_MS, getInboundCanaryTimes, inboundCanaryAddress } from "./inbound-canary";

export type InboundHealthStatus = "operational" | "degraded" | "down";

const CANARY_DEGRADED_AFTER_MS = INBOUND_CANARY_INTERVAL_MS * 2;
const CANARY_DOWN_AFTER_MS = INBOUND_CANARY_INTERVAL_MS * 4;
const QUEUE_BACKLOG_DEGRADED = 100;

const worst = (statuses: InboundHealthStatus[]) =>
  statuses.includes("down") ? "down" : statuses.includes("degraded") ? "degraded" : "operational";

export function canaryStatus(
  times: { firstSentAt: number | null; lastSeenAt: number | null },
  now = Date.now(),
): InboundHealthStatus {
  const reference = times.lastSeenAt ?? times.firstSentAt;
  if (reference === null) return "operational";
  const age = now - reference;
  if (age >= CANARY_DOWN_AFTER_MS) return "down";
  if (age >= CANARY_DEGRADED_AFTER_MS) return "degraded";
  return "operational";
}

export async function checkInboundHealth() {
  const checkedAt = new Date().toISOString();

  const rule = await withCache(`inbound:health:rule:${env.INBOUND_REGION}`, () => getReceivingRuleState(), { ttlSeconds: 300 }).catch(
    (error) => {
      logger.warn({ err: error }, "[InboundHealth]: Couldn't read the receipt rule");
      return null;
    },
  );
  const ruleStatus: InboundHealthStatus = !rule ? "degraded" : rule.ruleSetActive && rule.ruleEnabled && rule.notifiesTopic ? "operational" : "down";

  const queue = await getInboundQueueCounts().catch(() => null);
  const queueStatus: InboundHealthStatus = !queue ? "degraded" : queue.waiting + queue.delayed > QUEUE_BACKLOG_DEGRADED ? "degraded" : "operational";

  const canaryConfigured = inboundCanaryAddress() !== null;
  const canary = canaryConfigured ? await getInboundCanaryTimes() : null;
  const canaryHealth: InboundHealthStatus = canary ? canaryStatus(canary) : "operational";

  return {
    status: worst([ruleStatus, queueStatus, canaryHealth]),
    checkedAt,
    region: env.INBOUND_REGION,
    checks: {
      receiptRule: { status: ruleStatus, ...(rule ?? {}) },
      queue: { status: queueStatus, ...(queue ?? {}) },
      canary: canary
        ? {
            status: canaryHealth,
            lastSentAt: canary.lastSentAt ? new Date(canary.lastSentAt).toISOString() : null,
            lastSeenAt: canary.lastSeenAt ? new Date(canary.lastSeenAt).toISOString() : null,
          }
        : { status: "operational" as const, configured: false },
    },
  };
}
