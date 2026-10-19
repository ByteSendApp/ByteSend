import { DomainStatus, Plan } from "@prisma/client";
import { db } from "../db";
import { getAccount } from "../aws/ses";
import { logger } from "../logger/log";
import { SesSettingsService } from "./ses-settings-service";
import { AdminDeliverabilityService } from "./admin-deliverability-service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENTION_LIST_LIMIT = 8;

type UsageTotals = {
  sent: number;
  delivered: number;
  bounced: number;
  hardBounced: number;
  complained: number;
  opened: number;
  clicked: number;
};

type UsageDay = UsageTotals & { date: string };

type CountDay = { date: string; count: number };


function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function emptyTotals(): UsageTotals {
  return { sent: 0, delivered: 0, bounced: 0, hardBounced: 0, complained: 0, opened: 0, clicked: 0 };
}

function dateKeysBetween(start: Date, days: number) {
  return Array.from({ length: days }, (_, i) => toDateKey(new Date(start.getTime() + i * DAY_MS)));
}

async function getUsageByDay(startKey: string, endKey: string) {
  return db.$queryRaw<Array<UsageDay>>`
    SELECT
      d."date" AS date,
      SUM(d.sent)::integer AS sent,
      SUM(d.delivered)::integer AS delivered,
      SUM(d.bounced)::integer AS bounced,
      SUM(d."hardBounced")::integer AS "hardBounced",
      SUM(d.complained)::integer AS complained,
      SUM(d.opened)::integer AS opened,
      SUM(d.clicked)::integer AS clicked
    FROM "DailyEmailUsage" d
    WHERE d."date" >= ${startKey} AND d."date" <= ${endKey}
    GROUP BY d."date"
  `;
}

async function getUserSignupsByDay(since: Date) {
  return db.$queryRaw<Array<CountDay>>`
    SELECT to_char(date_trunc('day', u."createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::integer AS count
    FROM "User" u
    WHERE u."createdAt" >= ${since}
    GROUP BY 1
  `;
}

async function getTeamSignupsByDay(since: Date) {
  return db.$queryRaw<Array<CountDay>>`
    SELECT to_char(date_trunc('day', t."createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::integer AS count
    FROM "Team" t
    WHERE t."createdAt" >= ${since}
    GROUP BY 1
  `;
}

function sumUsage(rows: UsageDay[], fromKey: string, toKey: string) {
  return rows.reduce((acc, row) => {
    if (row.date < fromKey || row.date > toKey) return acc;
    acc.sent += row.sent;
    acc.delivered += row.delivered;
    acc.bounced += row.bounced;
    acc.hardBounced += row.hardBounced;
    acc.complained += row.complained;
    acc.opened += row.opened;
    acc.clicked += row.clicked;
    return acc;
  }, emptyTotals());
}

function sumCounts(rows: CountDay[], fromKey: string, toKey: string) {
  return rows.reduce((acc, row) => (row.date >= fromKey && row.date <= toKey ? acc + row.count : acc), 0);
}

export class AdminOverviewService {
  static async getOverview(days: number) {
    const today = utcMidnight(new Date());
    const currentStart = new Date(today.getTime() - (days - 1) * DAY_MS);
    const previousStart = new Date(currentStart.getTime() - days * DAY_MS);
    const previousEnd = new Date(currentStart.getTime() - DAY_MS);

    const todayKey = toDateKey(today);
    const currentStartKey = toDateKey(currentStart);
    const previousStartKey = toDateKey(previousStart);
    const previousEndKey = toDateKey(previousEnd);

    const failingDomainWhere = {
      status: { in: [DomainStatus.FAILED, DomainStatus.TEMPORARY_FAILURE] },
    };

    const [
      usageRows,
      userSignups,
      teamSignups,
      totalUsers,
      totalTeams,
      paidTeams,
      blockedTeams,
      blockedTeamCount,
      failingDomains,
      failingDomainCount,
      atRiskTeams,
    ] = await Promise.all([
      getUsageByDay(previousStartKey, todayKey),
      getUserSignupsByDay(previousStart),
      getTeamSignupsByDay(previousStart),
      db.user.count(),
      db.team.count(),
      db.team.count({ where: { plan: { not: Plan.FREE } } }),
      db.team.findMany({
        where: { isBlocked: true },
        select: { id: true, name: true, plan: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: ATTENTION_LIST_LIMIT,
      }),
      db.team.count({ where: { isBlocked: true } }),
      db.domain.findMany({
        where: failingDomainWhere,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          team: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: ATTENTION_LIST_LIMIT,
      }),
      db.domain.count({ where: failingDomainWhere }),
      AdminDeliverabilityService.getTeamStats({
        atRiskOnly: true,
        includeBlocked: false,
        limit: ATTENTION_LIST_LIMIT,
      }),
    ]);

    const usageByDate = new Map(usageRows.map((row) => [row.date, row]));
    const userSignupsByDate = new Map(userSignups.map((row) => [row.date, row.count]));
    const teamSignupsByDate = new Map(teamSignups.map((row) => [row.date, row.count]));

    const series = dateKeysBetween(currentStart, days).map((date) => ({
      ...emptyTotals(),
      ...usageByDate.get(date),
      date,
      newUsers: userSignupsByDate.get(date) ?? 0,
      newTeams: teamSignupsByDate.get(date) ?? 0,
    }));

    return {
      days,
      periodStart: currentStartKey,
      periodEnd: todayKey,
      usage: {
        current: sumUsage(usageRows, currentStartKey, todayKey),
        previous: sumUsage(usageRows, previousStartKey, previousEndKey),
      },
      signups: {
        users: {
          current: sumCounts(userSignups, currentStartKey, todayKey),
          previous: sumCounts(userSignups, previousStartKey, previousEndKey),
        },
        teams: {
          current: sumCounts(teamSignups, currentStartKey, todayKey),
          previous: sumCounts(teamSignups, previousStartKey, previousEndKey),
        },
      },
      totals: { users: totalUsers, teams: totalTeams, paidTeams },
      series,
      attention: {
        atRiskTeams,
        blockedTeams,
        blockedTeamCount,
        failingDomains,
        failingDomainCount,
      },
    };
  }

  static async getSesQuotas() {
    const settings = await SesSettingsService.getAllSettings();

    return Promise.all(
      settings.map(async (setting) => {
        try {
          const account = await getAccount(setting.region);
          return {
            region: setting.region,
            isActive: setting.isActive,
            max24HourSend: account.SendQuota?.Max24HourSend ?? null,
            sentLast24Hours: account.SendQuota?.SentLast24Hours ?? null,
            maxSendRate: account.SendQuota?.MaxSendRate ?? null,
            productionAccessEnabled: account.ProductionAccessEnabled ?? null,
            enforcementStatus: account.EnforcementStatus ?? null,
            error: null,
          };
        } catch (error) {
          logger.error({ err: error, region: setting.region }, "[AdminOverviewService]: Failed to load SES account");
          return {
            region: setting.region,
            isActive: setting.isActive,
            max24HourSend: null,
            sentLast24Hours: null,
            maxSendRate: null,
            productionAccessEnabled: null,
            enforcementStatus: null,
            error: error instanceof Error ? error.message : "Failed to load SES account",
          };
        }
      }),
    );
  }
}
