import { Queue, Worker } from "bullmq";
import { createWorkerHandler, TeamJob } from "../queue/bullmq-context";
import {
  CAMPAIGN_SCHEDULER_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "../queue/queue-constants";
import { getRedis, BULL_PREFIX } from "../redis";
import { CampaignBatchService } from "../service/campaign-service";
import { db } from "../db";
import { logger } from "../logger/log";
import { isSchedulerIdle, markSchedulerIdle } from "../queue/campaign-scheduler-state";

const SCHEDULER_TICK_MS = 1500;
const SCHEDULER_ID = "campaign-scheduler";

type SchedulerJob = TeamJob<{}>;

export class CampaignSchedulerService {
  private static schedulerQueue = new Queue<SchedulerJob>(
    CAMPAIGN_SCHEDULER_QUEUE,
    {
      connection: getRedis(),
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    }
  );

  static worker = new Worker(
    CAMPAIGN_SCHEDULER_QUEUE,
    createWorkerHandler(async (_job: SchedulerJob) => {
      try {
        if (await isSchedulerIdle()) return;

        const now = new Date();
        const campaigns = await db.campaign.findMany({
          where: {
            status: { in: ["SCHEDULED", "RUNNING"] },
            OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
          },
          select: {
            id: true,
            teamId: true,
            lastSentAt: true,
            batchWindowMinutes: true,
          },
        });

        if (campaigns.length === 0) {
          await markSchedulerIdle();
          return;
        }

        const enqueuePromises: Promise<any>[] = [];
        for (const c of campaigns) {
          const windowMin = c.batchWindowMinutes ?? 0;
          if (windowMin > 0 && c.lastSentAt) {
            const elapsedMs = now.getTime() - new Date(c.lastSentAt).getTime();
            const windowMs = windowMin * 60 * 1000;
            if (elapsedMs < windowMs) {
              const remainingMs = windowMs - elapsedMs;
              logger.debug(
                { campaignId: c.id, remainingMs, windowMs },
                "Skip queueing batch; window not elapsed"
              );
              continue;
            }
          }
          enqueuePromises.push(
            CampaignBatchService.queueBatch({
              campaignId: c.id,
              teamId: c.teamId,
            }).catch((err) => {
              logger.error(
                { err, campaignId: c.id },
                "Failed to enqueue campaign batch"
              );
            })
          );
        }

        if (enqueuePromises.length > 0) {
          const results = await Promise.allSettled(enqueuePromises);
          const rejected = results.filter(
            (r) => r.status === "rejected"
          ).length;
          const fulfilled = results.length - rejected;
          logger.debug(
            { total: results.length, fulfilled, rejected },
            "Scheduler enqueue summary"
          );
        }
      } catch (err) {
        logger.error({ err }, "Campaign scheduler tick failed");
      }
    }),
    { connection: getRedis(), concurrency: 1, prefix: BULL_PREFIX, skipVersionCheck: true }
  );

  static async start() {
    try {
      // Older builds registered the tick with queue.add({ repeat }); each tick interval it ever
      // used left a separate repeatable behind that kept firing, so clear them before upserting.
      const legacyRepeatables = (await this.schedulerQueue.getRepeatableJobs()).filter(
        (job) => job.key !== SCHEDULER_ID,
      );
      await Promise.all(
        legacyRepeatables.map((job) => this.schedulerQueue.removeRepeatableByKey(job.key)),
      );
      if (legacyRepeatables.length > 0) {
        logger.info({ removed: legacyRepeatables.length }, "Removed legacy campaign scheduler repeatables");
      }

      await this.schedulerQueue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: SCHEDULER_TICK_MS },
        { name: "tick", data: {}, opts: { ...DEFAULT_QUEUE_OPTIONS } },
      );
    } catch (err) {
      logger.error({ err }, "Failed to start campaign scheduler");
    }
  }
}
