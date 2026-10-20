import { db } from "../db";
import { classifyDeliverability } from "./admin-deliverability-service";
import { BLACKLISTS } from "./blacklist-service";
import { DELIVERABILITY_WINDOW_DAYS } from "~/lib/constants/deliverability";

const DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_DAYS = 30;
const SEARCH_GROUP_LIMIT = 5;
const EMAIL_SEARCH_WINDOW_DAYS = 30;

type UsageDay = {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  hardBounced: number;
  complained: number;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getTeamUsageByDay(teamId: number, sinceKey: string) {
  return db.$queryRaw<Array<UsageDay>>`
    SELECT
      d."date" AS date,
      SUM(d.sent)::integer AS sent,
      SUM(d.delivered)::integer AS delivered,
      SUM(d.bounced)::integer AS bounced,
      SUM(d."hardBounced")::integer AS "hardBounced",
      SUM(d.complained)::integer AS complained
    FROM "DailyEmailUsage" d
    WHERE d."teamId" = ${teamId} AND d."date" >= ${sinceKey}
    GROUP BY d."date"
  `;
}

export class AdminDetailService {
  static async getTeamDetail(teamId: number) {
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        plan: true,
        isBlocked: true,
        isActive: true,
        isVerified: true,
        sendingApprovedAt: true,
        billingEmail: true,
        stripeCustomerId: true,
        createdAt: true,
        apiRateLimit: true,
        dailyEmailLimit: true,
        extraDomainSlots: true,
        extraMemberSlots: true,
        customPlanEnabled: true,
        teamUsers: {
          select: {
            role: true,
            user: {
              select: { id: true, name: true, email: true, image: true, isBanned: true, isAdmin: true },
            },
          },
        },
        domains: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            registeredAt: true,
            status: true,
            region: true,
            createdAt: true,
            clickTracking: true,
            openTracking: true,
            dmarcAdded: true,
            pendingRegion: true,
            retiredRegion: true,
            blacklistChecks: {
              orderBy: { checkedAt: "desc" },
              take: BLACKLISTS.length,
              select: { list: true, status: true, checkedAt: true },
            },
          },
        },
        apiKeys: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            permission: true,
            partialToken: true,
            createdAt: true,
            lastUsed: true,
            domain: { select: { name: true } },
          },
        },
        webhookEndpoints: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            url: true,
            status: true,
            consecutiveFailures: true,
            lastFailureAt: true,
            lastSuccessAt: true,
          },
        },
        subscription: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
        _count: {
          select: { contactBooks: true, campaigns: true, templates: true, suppressionList: true },
        },
      },
    });

    if (!team) return null;

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const usageStart = new Date(todayUtc - (USAGE_DAYS - 1) * DAY_MS);
    const deliverabilityStartKey = dateKey(new Date(Date.now() - DELIVERABILITY_WINDOW_DAYS * DAY_MS));

    const usageRows = await getTeamUsageByDay(teamId, dateKey(usageStart));
    const usageByDate = new Map(usageRows.map((row) => [row.date, row]));

    const usage = Array.from({ length: USAGE_DAYS }, (_, i) => {
      const date = dateKey(new Date(usageStart.getTime() + i * DAY_MS));
      return {
        sent: 0,
        delivered: 0,
        bounced: 0,
        hardBounced: 0,
        complained: 0,
        ...usageByDate.get(date),
        date,
      };
    });

    const recent = usageRows
      .filter((row) => row.date >= deliverabilityStartKey)
      .reduce(
        (acc, row) => ({
          delivered: acc.delivered + row.delivered,
          hardBounced: acc.hardBounced + row.hardBounced,
          complained: acc.complained + row.complained,
        }),
        { delivered: 0, hardBounced: 0, complained: 0 },
      );

    return {
      ...team,
      usage,
      deliverability: { ...recent, ...classifyDeliverability(recent) },
    };
  }

  static async getUserDetail(userId: number) {
    const now = new Date();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        isBetaUser: true,
        isAdmin: true,
        isBanned: true,
        twoFactorEnabled: true,
        createdAt: true,
        accounts: { select: { id: true, provider: true, type: true } },
        backupEmails: { select: { id: true, email: true, emailVerified: true } },
        teamUsers: {
          select: {
            role: true,
            team: { select: { id: true, name: true, plan: true, isBlocked: true, createdAt: true } },
          },
        },
        _count: { select: { sessions: { where: { expires: { gt: now } } } } },
      },
    });

    return user;
  }

  static async globalSearch(rawQuery: string) {
    const query = rawQuery.trim();
    const numericId = /^\d+$/.test(query) ? Number(query) : null;
    const looksLikeEmail = query.includes("@");
    const looksLikeCuid = /^c[a-z0-9]{20,}$/i.test(query);
    const emailSince = new Date(Date.now() - EMAIL_SEARCH_WINDOW_DAYS * DAY_MS);

    const [users, teams, domains, emails] = await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            ...(numericId ? [{ id: numericId }] : []),
            { email: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        },
        take: SEARCH_GROUP_LIMIT,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, isBanned: true },
      }),
      db.team.findMany({
        where: {
          OR: [
            ...(numericId ? [{ id: numericId }] : []),
            { name: { contains: query, mode: "insensitive" as const } },
            { billingEmail: { contains: query, mode: "insensitive" as const } },
            { stripeCustomerId: { equals: query } },
            { subscription: { some: { id: { equals: query } } } },
          ],
        },
        take: SEARCH_GROUP_LIMIT,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, plan: true, isBlocked: true },
      }),
      db.domain.findMany({
        where: {
          OR: [
            ...(numericId ? [{ id: numericId }] : []),
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        },
        take: SEARCH_GROUP_LIMIT,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, team: { select: { id: true, name: true } } },
      }),
      // Recipient search is limited to recent mail so it stays on the createdAt index.
      looksLikeEmail || looksLikeCuid
        ? db.email.findMany({
            where: looksLikeCuid
              ? { OR: [{ id: query }, { sesEmailId: query }] }
              : { createdAt: { gte: emailSince }, to: { hasSome: [...new Set([query, query.toLowerCase()])] } },
            take: SEARCH_GROUP_LIMIT,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              subject: true,
              to: true,
              latestStatus: true,
              createdAt: true,
              team: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return { users, teams, domains, emails };
  }
}
