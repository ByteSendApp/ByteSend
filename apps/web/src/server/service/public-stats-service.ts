import { db } from "../db";
import { logger } from "../logger/log";
import { withCache } from "../redis";
import { regionLabel } from "~/lib/constants/regions";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const CACHE_TTL_SECONDS = 60 * 60;
const STATUS_STATS_URL = "https://status.bytesend.cloud/api/status/stats?range=30d";


export type PublicStatsDay = { date: string; sent: number; delivered: number; received: number };

export type PublicStats = {
  generatedAt: string;
  allTime: { sent: number; delivered: number };
  window: {
    days: number;
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
  };
  inbound: { received: number; dmarcReports: number; dmarcMessages: number };
  daily: PublicStatsDay[];
  regions: { code: string; label: string }[];
  uptime: number | null;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getAllTimeTotals() {
  const [row] = await db.$queryRaw<Array<{ sent: number | null; delivered: number | null }>>`
    SELECT SUM(d.sent)::float8 AS sent, SUM(d.delivered)::float8 AS delivered
    FROM "DailyEmailUsage" d
  `;
  return { sent: row?.sent ?? 0, delivered: row?.delivered ?? 0 };
}

async function getDailyUsage(startKey: string) {
  return db.$queryRaw<
    Array<{ date: string; sent: number; delivered: number; bounced: number; complained: number }>
  >`
    SELECT
      d."date" AS date,
      SUM(d.sent)::float8 AS sent,
      SUM(d.delivered)::float8 AS delivered,
      SUM(d.bounced)::float8 AS bounced,
      SUM(d.complained)::float8 AS complained
    FROM "DailyEmailUsage" d
    WHERE d."date" >= ${startKey}
    GROUP BY d."date"
  `;
}

async function getDailyReceived(start: Date) {
  return db.$queryRaw<Array<{ date: string; received: number }>>`
    SELECT to_char(i."receivedAt", 'YYYY-MM-DD') AS date, COUNT(*)::float8 AS received
    FROM "InboundEmail" i
    WHERE i."receivedAt" >= ${start}
    GROUP BY 1
  `;
}

async function getDmarcTotals(start: Date) {
  const result = await db.dmarcReport.aggregate({
    where: { createdAt: { gte: start } },
    _count: { _all: true },
    _sum: { messageCount: true },
  });
  return { dmarcReports: result._count._all, dmarcMessages: result._sum.messageCount ?? 0 };
}

async function getActiveRegions() {
  const settings = await db.sesSetting.findMany({
    where: { isActive: true },
    select: { region: true },
    orderBy: { region: "asc" },
  });
  return settings.map(({ region }) => ({ code: region, label: regionLabel(region) }));
}

async function getUptime(): Promise<number | null> {
  try {
    const res = await fetch(STATUS_STATS_URL, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { uptime?: unknown };
    return typeof body.uptime === "number" ? body.uptime : null;
  } catch (error) {
    logger.warn({ err: error }, "[PublicStats] Could not fetch uptime from the status page");
    return null;
  }
}

async function computePublicStats(): Promise<PublicStats> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (WINDOW_DAYS - 1) * DAY_MS);
  const startKey = toDateKey(start);

  const [allTime, usage, received, dmarc, regions, uptime] = await Promise.all([
    getAllTimeTotals(),
    getDailyUsage(startKey),
    getDailyReceived(start),
    getDmarcTotals(start),
    getActiveRegions(),
    getUptime(),
  ]);

  const byDate = new Map(usage.map((row) => [row.date, row]));
  const receivedByDate = new Map(received.map((row) => [row.date, row.received]));
  const daily = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = toDateKey(new Date(start.getTime() + i * DAY_MS));
    const row = byDate.get(date);
    return { date, sent: row?.sent ?? 0, delivered: row?.delivered ?? 0, received: receivedByDate.get(date) ?? 0 };
  });

  const window = usage.reduce(
    (acc, row) => {
      acc.sent += row.sent;
      acc.delivered += row.delivered;
      acc.bounced += row.bounced;
      acc.complained += row.complained;
      return acc;
    },
    { days: WINDOW_DAYS, sent: 0, delivered: 0, bounced: 0, complained: 0 },
  );

  const inbound = { received: daily.reduce((sum, day) => sum + day.received, 0), ...dmarc };

  return { generatedAt: new Date().toISOString(), allTime, window, inbound, daily, regions, uptime };
}

export const PublicStatsService = {
  async get(): Promise<PublicStats> {
    try {
      return await withCache("public-stats:v2", computePublicStats, { ttlSeconds: CACHE_TTL_SECONDS });
    } catch (error) {
      logger.error({ err: error }, "[PublicStats] Cache unavailable, computing directly");
      return computePublicStats();
    }
  },
};
