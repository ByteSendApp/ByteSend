import { getRedis, redisKey } from "../redis";
import { logger } from "../logger/log";

const IDLE_KEY = "campaign-scheduler:idle";
export const SCHEDULER_IDLE_TTL_SECONDS = 30;

export async function isSchedulerIdle() {
  try {
    return (await getRedis().exists(redisKey(IDLE_KEY))) === 1;
  } catch (error) {
    logger.warn({ err: error }, "[CampaignScheduler]: Could not read idle flag; querying anyway");
    return false;
  }
}

export async function markSchedulerIdle() {
  try {
    await getRedis().set(redisKey(IDLE_KEY), "1", "EX", SCHEDULER_IDLE_TTL_SECONDS);
  } catch (error) {
    logger.warn({ err: error }, "[CampaignScheduler]: Could not set idle flag");
  }
}

// Call whenever a campaign becomes SCHEDULED or RUNNING so the next tick picks it up immediately.
export async function wakeCampaignScheduler() {
  try {
    await getRedis().del(redisKey(IDLE_KEY));
  } catch (error) {
    logger.warn({ err: error }, "[CampaignScheduler]: Could not clear idle flag");
  }
}
