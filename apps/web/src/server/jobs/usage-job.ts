import { Queue, Worker } from "bullmq";
import { db } from "~/server/db";
import { env } from "~/env";
import { getUsageDate } from "~/lib/usage";
import { sendUsageToStripe } from "~/server/billing/usage";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import { DEFAULT_QUEUE_OPTIONS } from "../queue/queue-constants";
import { logger } from "../logger/log";
import { getThisMonthUsage } from "~/server/service/usage-service";
import { PLAN_LIMITS } from "~/lib/constants/plans";
import { Plan } from "@prisma/client";

const USAGE_QUEUE_NAME = "usage-reporting";

const METERED_PLANS: Plan[] = ["HOBBY", "LITE", "BASIC"];

const usageQueue = new Queue(USAGE_QUEUE_NAME, {
  connection: getRedis(),
  prefix: BULL_PREFIX,
  skipVersionCheck: true,
});

const worker = new Worker(
  USAGE_QUEUE_NAME,
  async () => {
    const yesterday = getUsageDate();

    const teams = await db.team.findMany({
      where: {
        stripeCustomerId: { not: null },
        plan: { in: METERED_PLANS },
        isActive: true,
      },
      include: {
        dailyEmailUsages: {
          where: {
            date: { equals: yesterday },
          },
        },
      },
    });

    for (const team of teams) {
      if (!team.stripeCustomerId) continue;

      const yesterdayMarketing = team.dailyEmailUsages
        .filter((u) => u.type === "MARKETING")
        .reduce((s, u) => s + u.sent, 0);
      const yesterdayTransactional = team.dailyEmailUsages
        .filter((u) => u.type === "TRANSACTIONAL")
        .reduce((s, u) => s + u.sent, 0);
      const totalYesterday = yesterdayMarketing + yesterdayTransactional;

      if (totalYesterday === 0) continue;

      try {
        const periodUsage = await getThisMonthUsage(team.id);

        const todayMarketing =
          periodUsage.day.find((u) => u.type === "MARKETING")?.sent ?? 0;
        const todayTransactional =
          periodUsage.day.find((u) => u.type === "TRANSACTIONAL")?.sent ?? 0;

        const periodMarketing =
          (periodUsage.month.find((u) => u.type === "MARKETING")?.sent ?? 0) -
          todayMarketing;
        const periodTransactional =
          (periodUsage.month.find((u) => u.type === "TRANSACTIONAL")?.sent ?? 0) -
          todayTransactional;
        const periodTotal = periodMarketing + periodTransactional;

        const priorTotal = Math.max(0, periodTotal - totalYesterday);

        if (team.customPlanEnabled) continue;

        const includedLimit = PLAN_LIMITS[team.plan as Plan].emailsPerMonth;
        if (includedLimit === -1) continue;

        const currentOverage = Math.max(0, periodTotal - includedLimit);
        const priorOverage = Math.max(0, priorTotal - includedLimit);
        const newOverage = currentOverage - priorOverage;

        if (newOverage <= 0) {
          logger.info(
            { teamId: team.id, date: yesterday, periodTotal, includedLimit },
            `[Usage Reporting] No overage for team`,
          );
          continue;
        }

        let marketingOverage: number;
        let transactionalOverage: number;

        if (newOverage >= totalYesterday) {
          marketingOverage = yesterdayMarketing;
          transactionalOverage = yesterdayTransactional;
        } else {
          marketingOverage = Math.round(
            newOverage * (yesterdayMarketing / totalYesterday),
          );
          transactionalOverage = newOverage - marketingOverage;
        }

        if (marketingOverage > 0) {
          await sendUsageToStripe(
            team.stripeCustomerId,
            marketingOverage,
            "marketing",
          );
        }
        if (transactionalOverage > 0) {
          await sendUsageToStripe(
            team.stripeCustomerId,
            transactionalOverage,
            "transactional",
          );
        }

        logger.info(
          {
            teamId: team.id,
            date: yesterday,
            periodTotal,
            includedLimit,
            newOverage,
            marketingOverage,
            transactionalOverage,
          },
          `[Usage Reporting] Reported overage for team`,
        );
      } catch (error) {
        logger.error(
          {
            err: error,
            teamId: team.id,
            message: error instanceof Error ? error.message : error,
          },
          `[Usage Reporting] Failed to report usage for team`,
        );
      }
    }
  },
  {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  },
);

await usageQueue.upsertJobScheduler(
  "daily-usage-report",
  {
    pattern: "0 */12 * * *",
    tz: "UTC",
  },
  {
    opts: {
      ...DEFAULT_QUEUE_OPTIONS,
    },
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, `[Usage Reporting] Job completed`);
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, `[Usage Reporting] Job failed`);
});
