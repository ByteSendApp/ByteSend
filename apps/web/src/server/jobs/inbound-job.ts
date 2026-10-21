import { Queue, Worker } from "bullmq";
import { getRedis, BULL_PREFIX } from "~/server/redis";
import { DEFAULT_QUEUE_OPTIONS, INBOUND_CLEANUP_QUEUE, INBOUND_QUEUE } from "../queue/queue-constants";
import { logger } from "../logger/log";
import { deleteExpiredInbound, processInbound, type SesInboundNotification } from "../service/inbound-service";
import { deleteExpiredDmarcReports } from "../service/dmarc-service";

let inboundQueue: Queue<SesInboundNotification> | null = null;
let initialized = false;

function getInboundQueue() {
  inboundQueue ??= new Queue<SesInboundNotification>(INBOUND_QUEUE, {
    connection: getRedis(),
    prefix: BULL_PREFIX,
    skipVersionCheck: true,
  });
  return inboundQueue;
}

export async function enqueueInbound(notification: SesInboundNotification) {
  await getInboundQueue().add("received", notification, {
    ...DEFAULT_QUEUE_OPTIONS,
    jobId: notification.mail.messageId,
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000 },
  });
}

export async function initInboundJobs() {
  if (initialized) return;
  const connection = getRedis();

  const worker = new Worker<SesInboundNotification>(
    INBOUND_QUEUE,
    async (job) => {
      const result = await processInbound(job.data);
      logger.info({ sesId: job.data.mail.messageId, ...result }, "[InboundJob]: Processed");
    },
    { connection, concurrency: 5, prefix: BULL_PREFIX, skipVersionCheck: true },
  );
  worker.on("failed", (job, err) => logger.error({ err, jobId: job?.id }, "[InboundJob]: Processing failed"));

  const cleanupQueue = new Queue(INBOUND_CLEANUP_QUEUE, { connection, prefix: BULL_PREFIX, skipVersionCheck: true });
  const cleanupWorker = new Worker(
    INBOUND_CLEANUP_QUEUE,
    async () => {
      const deleted = await deleteExpiredInbound();
      const reports = await deleteExpiredDmarcReports();
      logger.info({ deleted, reports }, "[InboundJob]: Removed expired received mail and DMARC reports");
    },
    { connection, concurrency: 1, prefix: BULL_PREFIX, skipVersionCheck: true },
  );
  cleanupWorker.on("failed", (job, err) => logger.error({ err, jobId: job?.id }, "[InboundJob]: Cleanup failed"));
  await cleanupQueue.upsertJobScheduler("inbound-cleanup-daily", { pattern: "40 3 * * *", tz: "UTC" }, { opts: { ...DEFAULT_QUEUE_OPTIONS } });

  initialized = true;
}
