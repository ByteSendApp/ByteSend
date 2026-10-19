import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import { BLACKLIST_CHECK_QUEUE, DEFAULT_QUEUE_OPTIONS } from "../queue/queue-constants";
import { logger } from "../logger/log";
import { BLACKLISTS, BlacklistService } from "../service/blacklist-service";
import { sendToDiscord } from "../service/notification-service";

let initialized = false;

export async function runBlacklistChecks() {
  const { checked, newlyListed } = await BlacklistService.checkAllVerifiedDomains();

  logger.info({ checked, newlyListed: newlyListed.length }, "[BlacklistCheckJob]: Domain blacklist checks finished");

  if (newlyListed.length === 0) return;

  const listNames = new Map(BLACKLISTS.map((list) => [list.id, list.name]));
  const lines = newlyListed.map(
    ({ domain, newlyListed: hits }) =>
      `• \`${domain.name}\` (team ${domain.team.name} #${domain.team.id}) — ${hits
        .map((hit) => `${listNames.get(hit.list) ?? hit.list} [${hit.returnCode}]`)
        .join(", ")}`,
  );
  await sendToDiscord(`🚫 **Domains newly blacklisted** (${newlyListed.length})\n${lines.join("\n")}`);
}

export async function initBlacklistCheckJob() {
  if (initialized) {
    return;
  }

  const connection = getRedis();
  const queue = new Queue(BLACKLIST_CHECK_QUEUE, {
    connection,
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });

  const worker = new Worker(
    BLACKLIST_CHECK_QUEUE,
    async () => {
      await runBlacklistChecks();
    },
    {
      connection,
      concurrency: 1,
      prefix: BULL_PREFIX,
      skipVersionCheck: true,
    },
  );

  await queue.upsertJobScheduler(
    "blacklist-check-daily",
    {
      pattern: "30 4 * * *",
      tz: "UTC",
    },
    {
      opts: {
        ...DEFAULT_QUEUE_OPTIONS,
      },
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "[BlacklistCheckJob]: Job failed");
  });

  initialized = true;
}
