import { Queue, Worker } from "bullmq";
import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import {
  DOMAIN_VERIFICATION_QUEUE,
  DEFAULT_QUEUE_OPTIONS,
} from "~/server/queue/queue-constants";
import {
  isDomainVerificationDue,
  refreshDomainVerification,
} from "~/server/service/domain-service";
import { DomainRegionService } from "~/server/service/domain-region-service";

let initialized = false;

export async function runDueDomainVerifications() {
  const domains = await db.domain.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  for (const domain of domains) {
    try {
      const isDue = await isDomainVerificationDue(domain);
      if (!isDue) {
        continue;
      }

      await refreshDomainVerification(domain);
    } catch (error) {
      logger.error(
        { err: error, domainId: domain.id },
        "[DomainVerificationJob]: Failed to refresh domain verification",
      );
    }
  }

  await runRegionMoves();
}

async function runRegionMoves() {
  const domains = await db.domain.findMany({
    where: { OR: [{ pendingRegion: { not: null } }, { retiredRegion: { not: null } }] },
  });

  for (const domain of domains) {
    try {
      if (domain.pendingRegion) {
        await DomainRegionService.refresh(domain);
      } else {
        await DomainRegionService.retireOldRegionIfDue(domain);
      }
    } catch (error) {
      logger.error(
        { err: error, domainId: domain.id },
        "[DomainVerificationJob]: Failed to process region move",
      );
    }
  }
}

export async function initDomainVerificationJob() {
  if (initialized) {
    return;
  }

  const connection = getRedis();
  const domainVerificationQueue = new Queue(DOMAIN_VERIFICATION_QUEUE, {
    connection,
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });

  const worker = new Worker(
    DOMAIN_VERIFICATION_QUEUE,
    async () => {
      await runDueDomainVerifications();
    },
    {
      connection,
      concurrency: 1,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  await domainVerificationQueue.upsertJobScheduler(
    "domain-verification-hourly",
    {
      pattern: "0 * * * *",
      tz: "UTC",
    },
    {
      opts: {
        ...DEFAULT_QUEUE_OPTIONS,
      },
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[DomainVerificationJob]: Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, jobId: job?.id },
      "[DomainVerificationJob]: Job failed",
    );
  });

  initialized = true;
}
