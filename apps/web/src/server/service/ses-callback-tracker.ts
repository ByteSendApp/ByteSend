import { getRedis, redisKey } from "../redis";
import { logger } from "../logger/log";

const RETENTION_SECONDS = 30 * 24 * 60 * 60;

const receivedKey = (topicArn: string) => redisKey(`ses-callback:received:${topicArn}`);
const REJECTED_KEY = redisKey("ses-callback:rejected");

export type RejectedCallback = { topicArn: string; at: string };

// Tracking is best-effort: a Redis hiccup must never fail the SNS callback itself.
export const SesCallbackTracker = {
  async recordReceived(topicArn: string) {
    try {
      await getRedis().set(receivedKey(topicArn), new Date().toISOString(), "EX", RETENTION_SECONDS);
    } catch (error) {
      logger.warn({ err: error }, "[SesCallbackTracker]: Could not record callback");
    }
  },

  async recordRejected(topicArn: string) {
    try {
      const value: RejectedCallback = { topicArn, at: new Date().toISOString() };
      await getRedis().set(REJECTED_KEY, JSON.stringify(value), "EX", RETENTION_SECONDS);
    } catch (error) {
      logger.warn({ err: error }, "[SesCallbackTracker]: Could not record rejected callback");
    }
  },

  async lastReceived(topicArn: string): Promise<string | null> {
    try {
      return await getRedis().get(receivedKey(topicArn));
    } catch {
      return null;
    }
  },

  async lastRejected(): Promise<RejectedCallback | null> {
    try {
      const raw = await getRedis().get(REJECTED_KEY);
      return raw ? (JSON.parse(raw) as RejectedCallback) : null;
    } catch {
      return null;
    }
  },
};
