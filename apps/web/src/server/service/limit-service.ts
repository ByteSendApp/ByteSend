import { PLAN_LIMITS, LimitReason } from "~/lib/constants/plans";
import { env } from "~/env";
import { getThisMonthUsage } from "./usage-service";
import { TeamService } from "./team-service";
import { withCache } from "../redis";
import { db } from "../db";
import { logger } from "../logger/log";
import { Plan, Team } from "@prisma/client";
import { sendToDiscord } from "./notification-service";
import { isInNewTeamRamp, NEW_TEAM_DAILY_LIMIT } from "~/lib/constants/trust";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
  BOUNCE_RATE_MIN_VOLUME,
  DELIVERABILITY_WINDOW_DAYS,
} from "~/lib/constants/deliverability";

function isLimitExceeded(current: number, limit: number): boolean {
  if (limit === -1) return false;
  return current >= limit;
}

export function getActivePlan(team: { plan: Plan; isActive: boolean }): Plan {
  return team.isActive ? team.plan : "FREE";
}

export function hasCustomPlan(team: Team): boolean {
  return Boolean(
    team.customPlanEnabled &&
    team.customMarketingEmailLimit &&
    team.customTransactionalEmailLimit,
  );
}

export function getCustomMonthlyTotalLimit(team: Team): number | null {
  if (!hasCustomPlan(team)) return null;
  return (team.customMarketingEmailLimit ?? 0) + (team.customTransactionalEmailLimit ?? 0);
}

export function getEffectiveDailyEmailLimit(team: Team): number {
  if (hasCustomPlan(team)) return -1;
  const planLimit = PLAN_LIMITS[getActivePlan(team)].emailsPerDay;
  if (isInNewTeamRamp(team)) {
    return planLimit === -1 ? NEW_TEAM_DAILY_LIMIT : Math.min(planLimit, NEW_TEAM_DAILY_LIMIT);
  }
  return planLimit;
}

function hasMarketingEnabled(team: Team): boolean {
  if (hasCustomPlan(team)) {
    return (team.customMarketingEmailLimit ?? 0) > 0;
  }
  return PLAN_LIMITS[getActivePlan(team)].marketingEmailsIncluded;
}

export class LimitService {

  private static async isAdminOrFounderTeam(teamId: number): Promise<boolean> {
    const adminEmails = [env.ADMIN_EMAIL, env.FOUNDER_EMAIL]
      .filter(Boolean)
      .map((email) => email!.trim().toLowerCase()) as string[];
    if (adminEmails.length === 0) return false;
    const count = await db.teamUser.count({
      where: {
        teamId,
        user: { email: { in: adminEmails, mode: "insensitive" } },
      },
    });
    return count > 0;
  }

  static async checkDomainLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.domain.count({ where: { teamId } });

    const baseDomainLimit = PLAN_LIMITS[getActivePlan(team)].domains;
    const extraSlots = getActivePlan(team) !== "FREE" ? (team.extraDomainSlots ?? 0) : 0;
    const limit = baseDomainLimit === -1 ? -1 : baseDomainLimit + extraSlots;
    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.DOMAIN,
      };
    }

    return {
      isLimitReached: false,
      limit,
      currentCount,
    };
  }

  static async checkContactsLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.contact.count({
      where: { contactBook: { teamId } },
    });

    const limit = PLAN_LIMITS[getActivePlan(team)].contacts;
    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.CONTACTS,
      };
    }

    return { isLimitReached: false, limit, currentCount };
  }

  static async checkContactBookLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.contactBook.count({ where: { teamId } });

    const limit = PLAN_LIMITS[getActivePlan(team)].contactBooks;
    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.CONTACT_BOOK,
      };
    }

    return {
      isLimitReached: false,
      limit,
      currentCount,
    };
  }

  static async checkTeamMemberLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.teamUser.count({ where: { teamId } });

    const baseMemberLimit = PLAN_LIMITS[getActivePlan(team)].teamMembers;
    const extraSlots = team.extraMemberSlots ?? 0;
    const limit = baseMemberLimit === -1 ? -1 : baseMemberLimit + extraSlots;
    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.TEAM_MEMBER,
      };
    }

    return {
      isLimitReached: false,
      limit,
      currentCount,
    };
  }

  static async checkCampaignLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.campaign.count({ where: { teamId } });
    const limit = PLAN_LIMITS[getActivePlan(team)].campaigns;

    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.CAMPAIGN,
      };
    }

    return {
      isLimitReached: false,
      limit,
      currentCount,
    };
  }

  static async checkWebhookLimit(teamId: number): Promise<{
    isLimitReached: boolean;
    limit: number;
    currentCount: number;
    reason?: LimitReason;
  }> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1, currentCount: 0 };
    }

    const team = await TeamService.getTeamCached(teamId);
    const currentCount = await db.webhook.count({
      where: { teamId },
    });

    const limit = PLAN_LIMITS[getActivePlan(team)].webhooks;
    if (isLimitExceeded(currentCount, limit)) {
      return {
        isLimitReached: true,
        limit,
        currentCount,
        reason: LimitReason.WEBHOOK,
      };
    }

    return {
      isLimitReached: false,
      limit,
      currentCount,
    };
  }

  private static async getRecentBounceStats(teamId: number): Promise<{
    delivered: number;
    hardBounced: number;
    complained: number;
  }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DELIVERABILITY_WINDOW_DAYS);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const result = await db.dailyEmailUsage.aggregate({
      where: { teamId, date: { gte: cutoffDate } },
      _sum: { delivered: true, hardBounced: true, complained: true },
    });

    return {
      delivered: result._sum.delivered ?? 0,
      hardBounced: result._sum.hardBounced ?? 0,
      complained: result._sum.complained ?? 0,
    };
  }

  static async checkEmailLimit(
    teamId: number,
    emailType?: "MARKETING" | "TRANSACTIONAL",
  ): Promise<{
    isLimitReached: boolean;
    limit: number;
    reason?: LimitReason;
    available?: number;
  }> {
    const team = await TeamService.getTeamCached(teamId);

    if (team.isBlocked) {
      return {
        isLimitReached: true,
        limit: 0,
        reason: LimitReason.EMAIL_BLOCKED,
      };
    }

    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      return { isLimitReached: false, limit: -1 };
    }

    if (await LimitService.isAdminOrFounderTeam(teamId)) {
      return { isLimitReached: false, limit: -1 };
    }

    const recentStats = await LimitService.getRecentBounceStats(teamId);
    if (recentStats.delivered >= BOUNCE_RATE_MIN_VOLUME) {
      const bounceRate = recentStats.hardBounced / recentStats.delivered;
      const complaintRate = recentStats.complained / recentStats.delivered;

      if (bounceRate >= BOUNCE_RATE_HARD_LIMIT) {
        logger.warn(
          { teamId, bounceRate, recentStats },
          "[LimitService]: Team blocked: bounce rate exceeds 2%",
        );
        sendToDiscord(
          `⚠️ **Sending blocked**: team \`${teamId}\` hard-bounce rate: **${(bounceRate * 100).toFixed(2)}%** (7-day). Threshold: 2%.`,
        ).catch(() => void 0);
        return {
          isLimitReached: true,
          limit: 0,
          reason: LimitReason.BOUNCE_RATE_EXCEEDED,
        };
      }

      if (complaintRate >= COMPLAINT_RATE_HARD_LIMIT) {
        logger.warn(
          { teamId, complaintRate, recentStats },
          "[LimitService]: Team blocked: complaint rate exceeds 0.1%",
        );
        sendToDiscord(
          `⚠️ **Sending blocked**: team \`${teamId}\` complaint rate: **${(complaintRate * 100).toFixed(3)}%** (7-day). Threshold: 0.1%.`,
        ).catch(() => void 0);
        return {
          isLimitReached: true,
          limit: 0,
          reason: LimitReason.COMPLAINT_RATE_EXCEEDED,
        };
      }

      if (bounceRate >= BOUNCE_RATE_WARN_LIMIT || complaintRate >= COMPLAINT_RATE_WARN_LIMIT) {
        logger.warn(
          { teamId, bounceRate, complaintRate, recentStats },
          "[LimitService]: Team approaching bounce/complaint rate limits",
        );
        sendToDiscord(
          `⚠️ **Reputation warning**: team \`${teamId}\` is approaching limits. Bounce: **${(bounceRate * 100).toFixed(2)}%**, Complaints: **${(complaintRate * 100).toFixed(3)}%** (7-day).`,
        ).catch(() => void 0);
      }
    }

    const activePlan = getActivePlan(team);

    if (emailType === "MARKETING" && !hasMarketingEnabled(team)) {
      return {
        isLimitReached: true,
        limit: 0,
        reason: LimitReason.EMAIL_BLOCKED,
      };
    }

    const usage = await withCache(
      `usage:this-month:${teamId}`,
      () => getThisMonthUsage(teamId),
      { ttlSeconds: 60 },
    );

    const dailyUsage = usage.day.reduce((acc, curr) => acc + curr.sent, 0);
    const dailyLimit = getEffectiveDailyEmailLimit(team);

    logger.info(
      { dailyUsage, dailyLimit, team },
      `[LimitService]: Daily usage and limit`,
    );

    if (isLimitExceeded(dailyUsage, dailyLimit)) {
      if (isInNewTeamRamp(team)) {
        return {
          isLimitReached: true,
          limit: dailyLimit,
          reason: LimitReason.NEW_TEAM_DAILY_LIMIT_REACHED,
          available: 0,
        };
      }
      try {
        await TeamService.maybeNotifyEmailLimitReached(
          teamId,
          dailyLimit,
          LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        );
      } catch (e) {
        logger.warn(
          { err: e },
          "Failed to send daily limit reached notification",
        );
      }

      return {
        isLimitReached: true,
        limit: dailyLimit,
        reason: LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        available: dailyLimit - dailyUsage,
      };
    }

    const monthlyMarketingUsage =
      usage.month.find((u) => u.type === "MARKETING")?.sent ?? 0;
    const monthlyTransactionalUsage =
      usage.month.find((u) => u.type === "TRANSACTIONAL")?.sent ?? 0;

    if (hasCustomPlan(team)) {
      const marketingLimit = team.customMarketingEmailLimit ?? -1;
      const transactionalLimit = team.customTransactionalEmailLimit ?? -1;
      const totalLimit = getCustomMonthlyTotalLimit(team) ?? -1;

      if (
        emailType === "MARKETING" &&
        isLimitExceeded(monthlyMarketingUsage, marketingLimit)
      ) {
        return {
          isLimitReached: true,
          limit: marketingLimit,
          reason: LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
          available: marketingLimit - monthlyMarketingUsage,
        };
      }

      if (
        emailType === "TRANSACTIONAL" &&
        isLimitExceeded(monthlyTransactionalUsage, transactionalLimit)
      ) {
        return {
          isLimitReached: true,
          limit: transactionalLimit,
          reason: LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
          available: transactionalLimit - monthlyTransactionalUsage,
        };
      }

      if (!emailType) {
        const totalUsage = monthlyMarketingUsage + monthlyTransactionalUsage;
        if (isLimitExceeded(totalUsage, totalLimit)) {
          return {
            isLimitReached: true,
            limit: totalLimit,
            reason: LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
            available: totalLimit - totalUsage,
          };
        }
      }
    }

    if (activePlan !== "FREE" && activePlan !== "LIFETIME" && !hasCustomPlan(team)) {
      const monthlyUsage = usage.month.reduce((acc, curr) => acc + curr.sent, 0);
      TeamService.notifyIncludedUsage(teamId, monthlyUsage, PLAN_LIMITS[activePlan].emailsPerMonth).catch((e) =>
        logger.warn({ err: e, teamId }, "[LimitService]: Included-usage notice failed"),
      );
    }

    if (getActivePlan(team) === "FREE") {
      const monthlyUsage = usage.month.reduce(
        (acc, curr) => acc + curr.sent,
        0,
      );
      const monthlyLimit = PLAN_LIMITS.FREE.emailsPerMonth;

      logger.info(
        { monthlyUsage, monthlyLimit, team, isActive: team.isActive },
        `[LimitService]: Monthly usage and limit (FREE plan or inactive subscription)`,
      );

      if (monthlyUsage / monthlyLimit > 0.8 && monthlyUsage < monthlyLimit) {
        await TeamService.sendWarningEmail(
          teamId,
          monthlyUsage,
          monthlyLimit,
          LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
        );
      }

      logger.info(
        { monthlyUsage, monthlyLimit, team, isActive: team.isActive },
        `[LimitService]: Monthly usage and limit (FREE plan or inactive subscription)`,
      );

      if (isLimitExceeded(monthlyUsage, monthlyLimit)) {
        try {
          await TeamService.maybeNotifyEmailLimitReached(
            teamId,
            monthlyLimit,
            LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
          );
        } catch (e) {
          logger.warn(
            { err: e },
            "Failed to send monthly limit reached notification",
          );
        }

        return {
          isLimitReached: true,
          limit: monthlyLimit,
          reason: LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
          available: monthlyLimit - monthlyUsage,
        };
      }
    }

    if (
      dailyLimit !== -1 &&
      dailyLimit > 0 &&
      dailyLimit - dailyUsage > 0 &&
      (dailyLimit - dailyUsage) / dailyLimit < 0.2
    ) {
      try {
        await TeamService.sendWarningEmail(
          teamId,
          dailyUsage,
          dailyLimit,
          LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        );
      } catch (e) {
        logger.warn({ err: e }, "Failed to send daily warning email");
      }
    }

    return {
      isLimitReached: false,
      limit: dailyLimit,
      available: dailyLimit - dailyUsage,
    };
  }

  static async checkMarketingAccess(teamId: number): Promise<boolean> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) return true;
    if (await LimitService.isAdminOrFounderTeam(teamId)) return true;
    const team = await TeamService.getTeamCached(teamId);
    return hasMarketingEnabled(team);
  }

}
