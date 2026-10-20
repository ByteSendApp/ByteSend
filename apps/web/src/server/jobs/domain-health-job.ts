import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import { DEFAULT_QUEUE_OPTIONS, DOMAIN_HEALTH_QUEUE } from "../queue/queue-constants";
import { logger } from "../logger/log";
import { DomainHealthService } from "../service/domain-health-service";

let initialized = false;

export async function initDomainHealthJob() {
  if (initialized) {
    return;
  }

  const connection = getRedis();
  const queue = new Queue(DOMAIN_HEALTH_QUEUE, {
    connection,
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });

  const worker = new Worker(
    DOMAIN_HEALTH_QUEUE,
    async () => {
      const result = await DomainHealthService.checkAll();
      logger.info(result, "[DomainHealthJob]: Domain DNS checks finished");
    },
    {
      connection,
      concurrency: 1,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  // Twice a day, so a problem is confirmed (two checks in a row) within about 12 hours.
  await queue.upsertJobScheduler(
    "domain-health-twice-daily",
    { pattern: "15 */12 * * *", tz: "UTC" },
    { opts: { ...DEFAULT_QUEUE_OPTIONS } },
  );

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "[DomainHealthJob]: Job failed");
  });

  initialized = true;
}
