import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { db } from "~/server/db";
import { sendMail, sendTeamInviteEmail } from "~/server/mailer";
import { logger } from "~/server/logger/log";
import type { Prisma, Team, TeamInvite } from "@prisma/client";
import { ByteSendApiError } from "../public-api/api-error";
import { getRedis, redisKey } from "~/server/redis";
import { LimitReason } from "~/lib/constants/plans";
import { LimitService } from "./limit-service";
import { renderUsageLimitReachedEmail } from "../email-templates/UsageLimitReachedEmail";
import { renderUsageWarningEmail } from "../email-templates/UsageWarningEmail";
import { sendToDiscord } from "./notification-service";

const TEAM_CACHE_TTL_SECONDS = 120;

export class TeamService {
  private static cacheKey(teamId: number) {
    return redisKey(`team:${teamId}`);
  }

  static async refreshTeamCache(teamId: number): Promise<Team | null> {
    const team = await db.team.findUnique({ where: { id: teamId } });

    if (!team) return null;

    const redis = getRedis();
    await redis.setex(
      TeamService.cacheKey(teamId),
      TEAM_CACHE_TTL_SECONDS,
      JSON.stringify(team),
    );
    return team;
  }

  static async invalidateTeamCache(teamId: number) {
    const redis = getRedis();
    await redis.del(TeamService.cacheKey(teamId));
  }

  static async getTeamCached(teamId: number): Promise<Team> {
    const redis = getRedis();
    const raw = await redis.get(TeamService.cacheKey(teamId));
    if (raw) {
      return JSON.parse(raw) as Team;
    }
    const fresh = await TeamService.refreshTeamCache(teamId);
    if (!fresh) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
    }
    return fresh;
  }

  static async createTeam(
    userId: number,
    name: string,
  ): Promise<Team | undefined> {
    if (!env.NEXT_PUBLIC_IS_CLOUD) {
      const _team = await db.team.findFirst();
      if (_team) {
        throw new TRPCError({
          message: "Can't have multiple teams in self hosted version",
          code: "UNAUTHORIZED",
        });
      }
    } else {
      const existingAdminTeams = await db.teamUser.findMany({
        where: { userId, role: "ADMIN" },
        include: { team: { select: { plan: true, isActive: true } } },
      });
      const hasUnpaidAdminTeam = existingAdminTeams.some(
        (tu) => !tu.team.isActive || tu.team.plan === "FREE",
      );
      if (hasUnpaidAdminTeam) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You already have a team on the Free plan. Upgrade your existing team to a paid plan before creating an additional team.",
        });
      }
    }

    const nameConflict = await db.team.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (nameConflict) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A team with that name already exists. Please choose a different name.",
      });
    }

    const created = await db.team.create({
      data: {
        name,
        teamUsers: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
      },
    });
    await TeamService.refreshTeamCache(created.id);

    sendToDiscord(`**New team created** 🏢\n**Name:** ${created.name}\n**Team ID:** ${created.id}`).catch(() => void 0);

    return created;
  }

  static async updateTeam(
    teamId: number,
    data: Prisma.TeamUpdateInput,
  ): Promise<Team> {
    if (typeof data.name === "string") {
      const nameConflict = await db.team.findFirst({
        where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id: teamId } },
      });
      if (nameConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A team with that name already exists. Please choose a different name.",
        });
      }
    }
    const updated = await db.team.update({ where: { id: teamId }, data });
    await TeamService.refreshTeamCache(teamId);
    return updated;
  }

  static async getUserTeams(userId: number) {
    return db.team.findMany({
      where: {
        teamUsers: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        teamUsers: {
          where: {
            userId: userId,
          },
        },
      },
    });
  }

  static async getTeamUsers(teamId: number) {
    return db.teamUser.findMany({
      where: {
        teamId,
      },
      include: {
        user: true,
      },
    });
  }

  static async getTeamInvites(teamId: number) {
    return db.teamInvite.findMany({
      where: {
        teamId,
      },
    });
  }

  static async createTeamInvite(
    teamId: number,
    email: string,
    role: "MEMBER" | "ADMIN",
    teamName: string,
    sendEmail: boolean = true,
  ): Promise<TeamInvite> {
    if (!email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Email is required",
      });
    }

    const { isLimitReached, limit, currentCount } = await LimitService.checkTeamMemberLimit(teamId);
    if (isLimitReached) {
      throw new ByteSendApiError({
        code: "FORBIDDEN",
        message: `Team member limit reached. You have ${currentCount}/${limit} members. Upgrade to add more members.`,
      });
    }

    const user = await db.user.findUnique({
      where: {
        email,
      },
      include: {
        teamUsers: true,
      },
    });

    const teamInvite = await db.teamInvite.create({
      data: {
        teamId,
        email,
        role,
      },
    });

    const teamUrl = `${env.NEXTAUTH_URL}/join-team?inviteId=${teamInvite.id}`;

    if (sendEmail) {
      await sendTeamInviteEmail(email, teamUrl, teamName);
    }

    return teamInvite;
  }

  static async updateTeamUserRole(
    teamId: number,
    userId: string,
    role: "MEMBER" | "ADMIN",
  ) {
    const teamUser = await db.teamUser.findFirst({
      where: {
        teamId,
        userId: Number(userId),
      },
    });

    if (!teamUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Team member not found",
      });
    }

    const adminCount = await db.teamUser.count({
      where: {
        teamId,
        role: "ADMIN",
      },
    });

    if (adminCount === 1 && teamUser.role === "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Need at least one admin",
      });
    }

    const updated = await db.teamUser.update({
      where: {
        teamId_userId: {
          teamId,
          userId: Number(userId),
        },
      },
      data: {
        role,
      },
    });
    await TeamService.invalidateTeamCache(teamId);
    return updated;
  }

  static async deleteTeamUser(
    teamId: number,
    userId: string,
    requestorRole: string,
    requestorId: number,
  ) {
    const teamUser = await db.teamUser.findFirst({
      where: {
        teamId,
        userId: Number(userId),
      },
    });

    if (!teamUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Team member not found",
      });
    }

    if (requestorRole !== "ADMIN" && requestorId !== Number(userId)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You are not authorized to delete this team member",
      });
    }

    const adminCount = await db.teamUser.count({
      where: {
        teamId,
        role: "ADMIN",
      },
    });

    if (adminCount === 1 && teamUser.role === "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Need at least one admin",
      });
    }

    const deleted = await db.teamUser.delete({
      where: {
        teamId_userId: {
          teamId,
          userId: Number(userId),
        },
      },
    });
    await TeamService.invalidateTeamCache(teamId);
    return deleted;
  }

  static async resendTeamInvite(
    teamId: number,
    inviteId: string,
    teamName: string,
  ) {
    const invite = await db.teamInvite.findFirst({
      where: {
        teamId,
        id: {
          equals: inviteId,
        },
      },
    });

    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invite not found",
      });
    }

    const teamUrl = `${env.NEXTAUTH_URL}/join-team?inviteId=${invite.id}`;

    await sendTeamInviteEmail(invite.email, teamUrl, teamName);

    return { success: true };
  }

  static async deleteTeamInvite(teamId: number, inviteId: string) {
    const invite = await db.teamInvite.findFirst({
      where: {
        teamId,
        id: {
          equals: inviteId,
        },
      },
    });

    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invite not found",
      });
    }

    return db.teamInvite.delete({
      where: {
        teamId_email: {
          teamId,
          email: invite.email,
        },
      },
    });
  }

  static async maybeNotifyEmailLimitReached(
    teamId: number,
    limit: number,
    reason: LimitReason | undefined,
  ) {
    logger.info(
      { teamId, limit, reason },
      "[TeamService]: maybeNotifyEmailLimitReached called",
    );
    if (!reason) {
      logger.info(
        { teamId },
        "[TeamService]: Skipping notify: no reason provided",
      );
      return;
    }
    if (
      ![
        LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
      ].includes(reason)
    ) {
      logger.info(
        { teamId, reason },
        "[TeamService]: Skipping notify: reason not eligible",
      );
      return;
    }

    const redis = getRedis();
    const cacheKey = redisKey(`limit:notify:${teamId}:${reason}`);
    const acquired = await redis.set(cacheKey, "1", "EX", 24 * 60 * 60, "NX");

    if (acquired !== "OK") {
      logger.info(
        { teamId, cacheKey },
        "[TeamService]: Skipping notify: cooldown active",
      );
      return;
    }

    const team = await TeamService.getTeamCached(teamId);
    const isPaidPlan = team.isActive && team.plan !== "FREE";
    const html = await getLimitReachedEmail(teamId, limit, reason);
    const subject =
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "ByteSend: You've reached your monthly email limit"
        : "ByteSend: You've reached your daily email limit";

    const text = `Hi ${team.name} team,\n\nYou've reached your ${reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "monthly"
        : "daily"
      } limit of ${limit.toLocaleString()} emails.\n\nSending is temporarily paused until your limit resets or ${isPaidPlan ? "your team is verified" : "your plan is upgraded"
      }.\n\nManage plan: ${env.NEXTAUTH_URL}/settings`;

    const teamUsers = await TeamService.getTeamUsers(teamId);
    const recipients = teamUsers
      .map((tu) => tu.user?.email)
      .filter((e): e is string => Boolean(e));

    logger.info(
      { teamId, recipientsCount: recipients.length, reason },
      "[TeamService]: Sending limit reached notifications",
    );

    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail(to, subject, text, html, "hey@bytesend.cloud"),
        ),
      );
      logger.info(
        { teamId, recipientsCount: recipients.length },
        "[TeamService]: Limit reached notifications sent",
      );
    } catch (err) {
      logger.error(
        { err, teamId },
        "[TeamService]: Failed sending limit reached notifications",
      );
      throw err;
    }
  }

  static async sendWarningEmail(
    teamId: number,
    used: number,
    limit: number,
    reason: LimitReason | undefined,
  ) {
    logger.info(
      { teamId, used, limit, reason },
      "[TeamService]: sendWarningEmail called",
    );
    if (!reason) {
      logger.info(
        { teamId },
        "[TeamService]: Skipping warning: no reason provided",
      );
      return;
    }

    if (
      ![
        LimitReason.EMAIL_DAILY_LIMIT_REACHED,
        LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED,
      ].includes(reason)
    ) {
      logger.info(
        { teamId, reason },
        "[TeamService]: Skipping warning: reason not eligible",
      );
      return;
    }

    const redis = getRedis();
    const cacheKey = redisKey(`limit:warning:${teamId}:${reason}`);
    const acquired = await redis.set(cacheKey, "1", "EX", 24 * 60 * 60, "NX");
    if (acquired !== "OK") {
      logger.info(
        { teamId, cacheKey },
        "[TeamService]: Skipping warning: cooldown active",
      );
      return;
    }

    const team = await TeamService.getTeamCached(teamId);
    const isPaidPlan = team.isActive && team.plan !== "FREE";

    const period =
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "monthly"
        : "daily";

    const html = await renderUsageWarningEmail({
      teamName: team.name,
      used,
      limit,
      isPaidPlan,
      period,
      manageUrl: `${env.NEXTAUTH_URL}/settings`,
    });

    const subject =
      period === "monthly"
        ? "ByteSend: You're nearing your monthly email limit"
        : "ByteSend: You're nearing your daily email limit";

    const text = `Hi ${team.name} team,\n\nYou've used ${used.toLocaleString()} of your ${period} limit of ${limit.toLocaleString()} emails.\n\nConsider ${isPaidPlan
        ? "verifying your team by replying to this email"
        : "upgrading your plan"
      }.\n\nManage plan: ${env.NEXTAUTH_URL}/settings`;

    const teamUsers = await TeamService.getTeamUsers(teamId);
    const recipients = teamUsers
      .map((tu) => tu.user?.email)
      .filter((e): e is string => Boolean(e));

    logger.info(
      { teamId, recipientsCount: recipients.length, reason },
      "[TeamService]: Sending warning notifications",
    );

    try {
      await Promise.all(
        recipients.map((to) =>
          sendMail(to, subject, text, html, "hey@bytesend.cloud"),
        ),
      );
      logger.info(
        { teamId, recipientsCount: recipients.length },
        "[TeamService]: Warning notifications sent",
      );
    } catch (err) {
      logger.error(
        { err, teamId },
        "[TeamService]: Failed sending warning notifications",
      );
      throw err;
    }
  }
}

async function getLimitReachedEmail(
  teamId: number,
  limit: number,
  reason: LimitReason,
) {
  const team = await TeamService.getTeamCached(teamId);
  const isPaidPlan = team.isActive && team.plan !== "FREE";
  const email = await renderUsageLimitReachedEmail({
    teamName: team.name,
    limit,
    isPaidPlan,
    period:
      reason === LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED
        ? "monthly"
        : "daily",
    manageUrl: `${env.NEXTAUTH_URL}/settings`,
  });
  return email;
}
