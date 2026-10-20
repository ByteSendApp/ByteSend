import { DomainStatus, type Team } from "@prisma/client";
import { PLAN_LIMITS } from "~/lib/constants/plans";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_MIN_VOLUME,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
  DELIVERABILITY_WINDOW_DAYS,
} from "~/lib/constants/deliverability";
import { isInNewTeamRamp, NEW_TEAM_DAILY_LIMIT, newTeamRampEndsAt } from "~/lib/constants/trust";
import { db } from "../db";
import {
  getActivePlan,
  getCustomMonthlyTotalLimit,
  getEffectiveDailyEmailLimit,
  hasCustomPlan,
} from "./limit-service";
import { getThisMonthUsage } from "./usage-service";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_EMAILS = 6;

export type SendingState =
  | { status: "active" }
  | { status: "new_team"; dailyLimit: number; endsAt: Date }
  | { status: "blocked" }
  | { status: "bounce_paused" | "complaint_paused" }
  | { status: "daily_limit" | "monthly_limit"; resetsAt: Date };

/** Infinite or negative limits mean "no limit"; null keeps that JSON-safe for the client. */
function finiteLimit(limit: number): number | null {
  return Number.isFinite(limit) && limit >= 0 ? limit : null;
}

function startOfTomorrowUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function startOfNextMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Works out why a team can or can't send right now, using the same rules as
 * LimitService.checkEmailLimit (which can't be called here: it sends warning emails).
 */
export function sendingState(input: {
  team: Team;
  usedToday: number;
  usedThisMonth: number;
  dailyLimit: number | null;
  monthlyCap: number | null;
  deliverability: { delivered: number; bounceRate: number; complaintRate: number };
}): SendingState {
  const { team, deliverability } = input;
  if (team.isBlocked) return { status: "blocked" };
  if (deliverability.delivered >= BOUNCE_RATE_MIN_VOLUME) {
    if (deliverability.bounceRate >= BOUNCE_RATE_HARD_LIMIT) return { status: "bounce_paused" };
    if (deliverability.complaintRate >= COMPLAINT_RATE_HARD_LIMIT) return { status: "complaint_paused" };
  }
  if (input.dailyLimit !== null && input.usedToday >= input.dailyLimit) {
    return { status: "daily_limit", resetsAt: startOfTomorrowUtc() };
  }
  if (input.monthlyCap !== null && input.usedThisMonth >= input.monthlyCap) {
    return { status: "monthly_limit", resetsAt: startOfNextMonthUtc() };
  }
  if (isInNewTeamRamp(team)) {
    return { status: "new_team", dailyLimit: NEW_TEAM_DAILY_LIMIT, endsAt: newTeamRampEndsAt(team) };
  }
  return { status: "active" };
}

export const DashboardOverviewService = {
  async get(team: Team) {
    const since = new Date(Date.now() - DELIVERABILITY_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);

    const [usage, deliverability, domains, apiKeys, webhooks, sentEmails, recentEmails] = await Promise.all([
      getThisMonthUsage(team.id),
      db.dailyEmailUsage.aggregate({
        where: { teamId: team.id, date: { gte: since } },
        _sum: { sent: true, delivered: true, hardBounced: true, complained: true },
      }),
      db.domain.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, status: true, region: true, dnsIssues: true, dnsIssuesNotifiedAt: true },
      }),
      db.apiKey.count({ where: { teamId: team.id } }),
      db.webhook.count({ where: { teamId: team.id } }),
      db.email.count({ where: { teamId: team.id }, take: 1 }),
      db.email.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "desc" },
        take: RECENT_EMAILS,
        select: { id: true, to: true, subject: true, latestStatus: true, createdAt: true },
      }),
    ]);

    const usedToday = usage.day.reduce((sum, row) => sum + row.sent, 0);
    const usedThisMonth = usage.month.reduce((sum, row) => sum + row.sent, 0);

    const plan = getActivePlan(team);
    const dailyLimit = finiteLimit(getEffectiveDailyEmailLimit(team));
    // Free plans stop at their monthly limit; paid plans include an allowance and bill overage.
    const monthlyAllowance = hasCustomPlan(team)
      ? finiteLimit(getCustomMonthlyTotalLimit(team) ?? -1)
      : finiteLimit(PLAN_LIMITS[plan].emailsPerMonth);
    const monthlyCap = plan === "FREE" || hasCustomPlan(team) ? monthlyAllowance : null;

    const delivered = deliverability._sum.delivered ?? 0;
    const bounceRate = delivered > 0 ? (deliverability._sum.hardBounced ?? 0) / delivered : 0;
    const complaintRate = delivered > 0 ? (deliverability._sum.complained ?? 0) / delivered : 0;
    const rates = { delivered, bounceRate, complaintRate };

    const verifiedDomains = domains.filter((d) => d.status === DomainStatus.SUCCESS).length;

    return {
      plan,
      sending: sendingState({ team, usedToday, usedThisMonth, dailyLimit, monthlyCap, deliverability: rates }),
      usage: {
        today: usedToday,
        dailyLimit,
        thisMonth: usedThisMonth,
        monthlyAllowance,
        billsOverage: monthlyCap === null && monthlyAllowance !== null && plan !== "LIFETIME",
      },
      deliverability: {
        ...rates,
        sent: deliverability._sum.sent ?? 0,
        windowDays: DELIVERABILITY_WINDOW_DAYS,
        minVolume: BOUNCE_RATE_MIN_VOLUME,
        bounce: { warn: BOUNCE_RATE_WARN_LIMIT, limit: BOUNCE_RATE_HARD_LIMIT },
        complaint: { warn: COMPLAINT_RATE_WARN_LIMIT, limit: COMPLAINT_RATE_HARD_LIMIT },
      },
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        region: d.region,
        dnsIssues: d.dnsIssuesNotifiedAt && Array.isArray(d.dnsIssues) ? (d.dnsIssues as string[]) : [],
      })),
      onboarding: {
        domainAdded: domains.length > 0,
        domainVerified: verifiedDomains > 0,
        apiKeyCreated: apiKeys > 0,
        firstEmailSent: sentEmails > 0,
        webhookAdded: webhooks > 0,
      },
      recentEmails,
    };
  },
};
