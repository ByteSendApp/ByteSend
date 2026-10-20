import { BlocklistType, EmailStatus, Prisma, type Plan } from "@prisma/client";
import { z } from "zod";
import { env } from "~/env";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, adminProcedure, founderProcedure } from "~/server/api/trpc";
import { SesSettingsService } from "~/server/service/ses-settings-service";
import { getAccount } from "~/server/aws/ses";
import { db } from "~/server/db";
import { sendMail } from "~/server/mailer";
import { logger } from "~/server/logger/log";
import { ByteSend } from "bytesend-js";
import { isCloud } from "~/utils/common";
import { toPlainHtml } from "~/server/utils/email-content";
import { Target } from "lucide-react";
import { createCheckoutSessionForTeam, type CheckoutPlan } from "~/server/billing/payments";
import { TeamService } from "~/server/service/team-service";
import { AdminOverviewService } from "~/server/service/admin-overview-service";
import { AdminAuditService, diffFields } from "~/server/service/admin-audit-service";
import { ensureReceivingRules, inboundMxHost } from "~/server/aws/ses-receiving";
import { isInboundEnabled } from "~/server/service/inbound-storage";
import { SesCallbackDiagnosticsService } from "~/server/service/ses-callback-diagnostics-service";
import { BanService } from "~/server/service/ban-service";
import { BlocklistService, normalizeBlocklistValue } from "~/server/service/blocklist-service";
import { AdminDeliverabilityService } from "~/server/service/admin-deliverability-service";
import { AdminDetailService } from "~/server/service/admin-detail-service";
import { BlacklistService } from "~/server/service/blacklist-service";
import { DomainRegionService } from "~/server/service/domain-region-service";
import { AdminSpamService } from "~/server/service/admin-spam-service";
import { AdminEmailService, ADMIN_EMAIL_MAX_WINDOW_DAYS } from "~/server/service/admin-email-service";
import { ADMIN_AUDIT_TARGET_TYPES } from "~/lib/constants/admin-audit";

const BLACKLIST_RECHECK_COOLDOWN_MS = 5 * 60 * 1000;

function actorFrom(ctx: { session: { user: { id: number; email?: string | null } } }) {
  return { id: ctx.session.user.id, email: ctx.session.user.email };
}

const userAdminSelection = {
  id: true,
  email: true,
  name: true,
  isBetaUser: true,
  isAdmin: true,
  isBanned: true,
  createdAt: true,
} as const;

function formatDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? email;
  const pieces = localPart.split(/[._-]+/).filter(Boolean);
  if (pieces.length === 0) {
    return localPart;
  }
  return pieces
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

const teamAdminSelection = {
  id: true,
  name: true,
  plan: true,
  apiRateLimit: true,
  dailyEmailLimit: true,
  isBlocked: true,
  isActive: true,
  billingEmail: true,
  extraDomainSlots: true,
  extraMemberSlots: true,
  createdAt: true,
  teamUsers: {
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  },
  domains: {
    select: {
      id: true,
      name: true,
      status: true,
      isVerifying: true,
    },
  },
} as const;

const adminDomainSelection = {
  id: true,
  name: true,
  status: true,
  region: true,
  clickTracking: true,
  openTracking: true,
  isVerifying: true,
  createdAt: true,
  team: {
    select: {
      id: true,
      name: true,
      plan: true,
      isBlocked: true,
    },
  },
} as const;

const adminWebhookSelection = {
  id: true,
  url: true,
  status: true,
  eventTypes: true,
  domainIds: true,
  consecutiveFailures: true,
  lastFailureAt: true,
  lastSuccessAt: true,
  createdAt: true,
  team: {
    select: {
      id: true,
      name: true,
      plan: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} as const;

export const adminRouter = createTRPCRouter({
  getOverview: adminProcedure
    .input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
    .query(async ({ input }) => AdminOverviewService.getOverview(input.days)),

  getSesQuotas: adminProcedure.query(async () => AdminOverviewService.getSesQuotas()),

  listDeliverability: adminProcedure
    .input(
      z.object({
        atRiskOnly: z.boolean().default(false),
        query: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) =>
      AdminDeliverabilityService.getTeamStats({
        atRiskOnly: input.atRiskOnly,
        query: input.query || undefined,
        limit: input.limit,
      }),
    ),

  setTeamBlocked: adminProcedure
    .input(
      z.object({
        teamId: z.number().int(),
        isBlocked: z.boolean(),
        reason: z.string().trim().min(3, "Give a short reason").max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await db.team.findUnique({ where: { id: input.teamId }, select: { id: true } });
      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }
      return AdminDeliverabilityService.setTeamBlocked({ actor: actorFrom(ctx), ...input });
    }),

  getInboundSetup: adminProcedure.query(() => ({
    enabled: isInboundEnabled(),
    region: env.INBOUND_REGION,
    bucket: env.INBOUND_S3_BUCKET ?? null,
    topicArn: env.INBOUND_SNS_TOPIC_ARN ?? null,
    hostedDomain: env.INBOUND_HOSTED_DOMAIN ?? null,
    mxHost: inboundMxHost(),
  })),

  setupInbound: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ensureReceivingRules();
    await AdminAuditService.record({
      actor: actorFrom(ctx),
      action: "ses.inbound_setup",
      targetType: "ses",
      targetId: result.region,
      metadata: result,
    });
    return result;
  }),

  setTeamSendingApproved: adminProcedure
    .input(z.object({ teamId: z.number().int(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const team = await db.team.update({
        where: { id: input.teamId },
        data: { sendingApprovedAt: input.approved ? new Date() : null },
        select: { id: true, sendingApprovedAt: true },
      });
      await TeamService.invalidateTeamCache(input.teamId);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: input.approved ? "team.sending.approve" : "team.sending.revoke",
        targetType: "team",
        targetId: input.teamId,
      });
      return team;
    }),

  getTeamDetail: adminProcedure
    .input(z.object({ teamId: z.number().int() }))
    .query(async ({ input }) => {
      const team = await AdminDetailService.getTeamDetail(input.teamId);
      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }
      return team;
    }),

  getUserDetail: adminProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ input }) => {
      const user = await AdminDetailService.getUserDetail(input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return user;
    }),

  globalSearch: adminProcedure
    .input(z.object({ query: z.string().trim().min(2).max(200) }))
    .query(async ({ input }) => AdminDetailService.globalSearch(input.query)),

  listEmails: adminProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          from: z.date(),
          to: z.date(),
          teamId: z.number().int().optional(),
          domainId: z.number().int().optional(),
          statuses: z.array(z.nativeEnum(EmailStatus)).max(20).optional(),
          recipient: z.string().trim().max(320).optional(),
          sender: z.string().trim().max(320).optional(),
          subject: z.string().trim().max(200).optional(),
        })
        .refine((value) => value.from <= value.to, { message: "Start must be before end" })
        .refine(
          (value) => value.to.getTime() - value.from.getTime() <= ADMIN_EMAIL_MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000,
          { message: `Pick a window of ${ADMIN_EMAIL_MAX_WINDOW_DAYS} days or less` },
        ),
    )
    .query(async ({ input }) =>
      AdminEmailService.list({
        ...input,
        recipient: input.recipient || undefined,
        sender: input.sender || undefined,
        subject: input.subject || undefined,
      }),
    ),

  getEmail: adminProcedure
    .input(z.object({ emailId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const email = await AdminEmailService.get(input.emailId);
      if (!email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }
      return email;
    }),

  viewEmailContent: adminProcedure
    .input(z.object({ emailId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const content = await AdminEmailService.viewContent(input.emailId, actorFrom(ctx));
      if (!content) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }
      return content;
    }),

  getBlacklistOverview: adminProcedure.query(async () => BlacklistService.getOverview()),

  recheckDomainBlacklist: adminProcedure
    .input(z.object({ domainId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: { id: true, name: true, teamId: true },
      });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }

      const lastCheck = await db.domainBlacklistCheck.findFirst({
        where: { domainId: domain.id },
        orderBy: { checkedAt: "desc" },
        select: { checkedAt: true },
      });
      if (lastCheck && Date.now() - lastCheck.checkedAt.getTime() < BLACKLIST_RECHECK_COOLDOWN_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "This domain was checked in the last 5 minutes",
        });
      }

      const { results } = await BlacklistService.checkDomain(domain);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "domain.blacklist_recheck",
        targetType: "domain",
        targetId: domain.id,
        metadata: {
          domainName: domain.name,
          teamId: domain.teamId,
          listed: results.filter((result) => result.status === "LISTED").map((result) => result.list).join(", "),
        },
      });
      return results;
    }),

  adminStartRegionMove: adminProcedure
    .input(z.object({ domainId: z.number().int(), region: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findUnique({ where: { id: input.domainId } });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }
      await DomainRegionService.start(domain, input.region);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "domain.region_move.start",
        targetType: "domain",
        targetId: domain.id,
        metadata: { domainName: domain.name, teamId: domain.teamId, from: domain.region, to: input.region },
      });
      return { success: true };
    }),

  adminCancelRegionMove: adminProcedure
    .input(z.object({ domainId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findUnique({ where: { id: input.domainId } });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }
      await DomainRegionService.cancel(domain);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "domain.region_move.cancel",
        targetType: "domain",
        targetId: domain.id,
        metadata: { domainName: domain.name, teamId: domain.teamId, from: domain.region, to: domain.pendingRegion },
      });
      return { success: true };
    }),

  listSpamScans: adminProcedure
    .input(
      z.object({
        filter: z.enum(["held", "flagged", "reviewed"]).default("held"),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input }) => AdminSpamService.list(input)),

  countHeldSpam: adminProcedure.query(async () => AdminSpamService.countHeld()),

  releaseSpamHold: adminProcedure
    .input(z.object({ scanId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await AdminSpamService.release(input.scanId, actorFrom(ctx));
      return { success: true };
    }),

  rejectSpamHold: adminProcedure
    .input(z.object({ scanId: z.string().min(1).max(64), reason: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await AdminSpamService.reject(input.scanId, actorFrom(ctx), input.reason);
      return { success: true };
    }),

  listAuditLog: adminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        action: z.string().max(64).optional(),
        targetType: z.enum(ADMIN_AUDIT_TARGET_TYPES).optional(),
        targetId: z.string().max(64).optional(),
        actorId: z.number().int().optional(),
        query: z.string().trim().max(200).optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ input }) => AdminAuditService.list(input)),

  getSesSettings: adminProcedure.query(async () => {
    return SesSettingsService.getAllSettings();
  }),

  getQuotaForRegion: adminProcedure
    .input(
      z.object({
        region: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const acc = await getAccount(input.region);
      return acc.SendQuota?.MaxSendRate;
    }),

  addSesSettings: adminProcedure
    .input(
      z.object({
        region: z.string(),
        bytesendUrl: z.string().url(),
        sendRate: z.number(),
        transactionalQuota: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setting = await SesSettingsService.createSesSetting({
        region: input.region,
        bytesendUrl: input.bytesendUrl,
        sendingRateLimit: input.sendRate,
        transactionalQuota: input.transactionalQuota,
      });
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "ses.create",
        targetType: "ses",
        targetId: input.region,
        metadata: {
          bytesendUrl: input.bytesendUrl,
          sendRate: input.sendRate,
          transactionalQuota: input.transactionalQuota,
        },
      });
      return setting;
    }),

  updateSesSettings: adminProcedure
    .input(
      z.object({
        settingsId: z.string(),
        sendRate: z.number(),
        transactionalQuota: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setting = await SesSettingsService.updateSesSetting({
        id: input.settingsId,
        sendingRateLimit: input.sendRate,
        transactionalQuota: input.transactionalQuota,
      });
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "ses.update",
        targetType: "ses",
        targetId: input.settingsId,
        metadata: { sendRate: input.sendRate, transactionalQuota: input.transactionalQuota },
      });
      return setting;
    }),

  deleteSesSettings: adminProcedure
    .input(z.object({ settingsId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await SesSettingsService.deleteSesSetting(input.settingsId);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "ses.delete",
        targetType: "ses",
        targetId: input.settingsId,
      });
      return result;
    }),

  toggleSesSettingsActive: adminProcedure
    .input(z.object({ settingsId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await SesSettingsService.toggleSesSettingActive(input.settingsId, input.isActive);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "ses.toggle",
        targetType: "ses",
        targetId: input.settingsId,
        metadata: { isActive: input.isActive },
      });
      return result;
    }),

  getSesCallbackDiagnostics: adminProcedure.query(async () => SesCallbackDiagnosticsService.diagnose()),

  repairSesCallbacks: adminProcedure
    .input(z.object({ settingsId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await SesCallbackDiagnosticsService.repair(input.settingsId);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "ses.repair",
        targetType: "ses",
        targetId: input.settingsId,
        metadata: { actions: result.actions },
      });
      return result;
    }),

  getSetting: adminProcedure
    .input(
      z.object({
        region: z.string().optional().nullable(),
      }),
    )
    .query(async ({ input }) => {
      return SesSettingsService.getSetting(
        input.region ?? env.AWS_DEFAULT_REGION,
      );
    }),

  findUserByEmail: adminProcedure
    .input(
      z.object({
        email: z
          .string()
          .email()
          .transform((value) => value.toLowerCase()),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { email: input.email },
        select: userAdminSelection,
      });

      return user ?? null;
    }),

  updateUserBeta: founderProcedure
    .input(
      z.object({
        userId: z.number(),
        isBetaUser: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: userAdminSelection,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const updated = await db.user.update({
        where: { id: input.userId },
        data: { isBetaUser: input.isBetaUser },
        select: userAdminSelection,
      });
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "user.beta.update",
        targetType: "user",
        targetId: input.userId,
        metadata: { email: user.email, isBetaUser: input.isBetaUser },
      });
      return updated;
    }),

  setUserAdmin: founderProcedure
    .input(
      z.object({
        userId: z.number(),
        isAdmin: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const target = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true },
      });

      if (!target) {
        throw new Error("User not found");
      }

      if (target.email === env.FOUNDER_EMAIL) {
        throw new Error("Cannot modify the founder's admin status");
      }

      const updated = await db.user.update({
        where: { id: input.userId },
        data: { isAdmin: input.isAdmin },
        select: userAdminSelection,
      });
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "user.admin.update",
        targetType: "user",
        targetId: input.userId,
        metadata: { email: target.email, isAdmin: input.isAdmin },
      });
      return updated;
    }),

  banUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        isBanned: z.boolean(),
        reason: z.string().trim().max(300).optional(),
        blockMailboxes: z.boolean().default(true),
        blockDomains: z.array(z.string().trim().min(1)).max(50).default([]),
        alsoBanUserIds: z.array(z.number()).max(25).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targets = await db.user.findMany({
        where: { id: { in: [input.userId, ...input.alsoBanUserIds] } },
        select: { id: true, email: true },
      });
      const target = targets.find((t) => t.id === input.userId);

      if (!target) {
        throw new Error("User not found");
      }
      if (targets.some((t) => t.email && t.email === env.FOUNDER_EMAIL)) {
        throw new Error("Cannot ban the founder account");
      }
      if (input.isBanned && [input.userId, ...input.alsoBanUserIds].includes(ctx.session.user.id)) {
        throw new Error("You can't ban yourself");
      }

      if (!input.isBanned) {
        const { removedEntries } = await BanService.unban(input.userId);
        await AdminAuditService.record({
          actor: actorFrom(ctx),
          action: "user.unban",
          targetType: "user",
          targetId: input.userId,
          metadata: { email: target.email, removedBlocklistEntries: removedEntries },
        });
        return db.user.findUniqueOrThrow({ where: { id: input.userId }, select: userAdminSelection });
      }

      const result = await BanService.ban(
        input.userId,
        {
          reason: input.reason,
          blockMailboxes: input.blockMailboxes,
          blockDomains: input.blockDomains,
          alsoBanUserIds: input.alsoBanUserIds,
        },
        ctx.session.user.id,
      );
      for (const userId of result.bannedUserIds) {
        await AdminAuditService.record({
          actor: actorFrom(ctx),
          action: "user.ban",
          targetType: "user",
          targetId: userId,
          metadata: {
            email: targets.find((t) => t.id === userId)?.email,
            reason: input.reason,
            ...(userId === input.userId ? { blocked: result.blocked, alsoBanned: input.alsoBanUserIds } : { relatedTo: input.userId }),
          },
        });
      }
      return db.user.findUniqueOrThrow({ where: { id: input.userId }, select: userAdminSelection });
    }),

  getBanPreview: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => BanService.preview(input.userId)),

  getRelatedAccounts: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => BanService.relatedAccounts(input.userId)),

  listBlocklist: adminProcedure
    .input(
      z.object({
        type: z.nativeEnum(BlocklistType).optional(),
        query: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input }) => BlocklistService.list(input)),

  addBlocklistEntry: adminProcedure
    .input(
      z.object({
        type: z.nativeEnum(BlocklistType),
        value: z.string().trim().min(3).max(253),
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const value = normalizeBlocklistValue(input.type, input.value);
      if (input.type === BlocklistType.EMAIL ? !value.includes("@") : !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: input.type === BlocklistType.EMAIL ? "Enter a full email address." : "Enter a domain like example.com.",
        });
      }
      const entry = await BlocklistService.add({ ...input, createdById: ctx.session.user.id });
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "blocklist.add",
        targetType: "blocklist",
        targetId: entry.id,
        metadata: { type: entry.type, value: entry.value, reason: input.reason },
      });
      return entry;
    }),

  removeBlocklistEntry: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await BlocklistService.remove(input.id);
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "blocklist.remove",
        targetType: "blocklist",
        targetId: entry.id,
        metadata: { type: entry.type, value: entry.value },
      });
      return entry;
    }),

  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, query } = input;
      const skip = (page - 1) * pageSize;

      const numericId = query && /^\d+$/.test(query) ? Number(query) : null;
      const where: Prisma.UserWhereInput = query
        ? {
          OR: [
            ...(numericId ? [{ id: numericId }] : []),
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
        : {};

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: userAdminSelection,
        }),
        db.user.count({ where }),
      ]);

      const flags = await BanService.evasionFlags(users);
      return {
        users: users.map((user) => ({ ...user, evasion: flags.get(user.id) ?? null })),
        total,
        page,
        pageSize,
      };
    }),

  findTeam: adminProcedure
    .input(
      z.object({
        query: z
          .string({ required_error: "Search query is required" })
          .trim()
          .min(1, "Search query is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const query = input.query.trim();

      let numericId: number | null = null;
      if (/^\d+$/.test(query)) {
        numericId = Number(query);
      }

      let team = numericId
        ? await db.team.findUnique({
          where: { id: numericId },
          select: teamAdminSelection,
        })
        : null;

      if (!team) {
        team = await db.team.findFirst({
          where: {
            OR: [
              { name: { equals: query, mode: "insensitive" } },
              { billingEmail: { equals: query, mode: "insensitive" } },
              {
                teamUsers: {
                  some: {
                    user: {
                      email: { equals: query, mode: "insensitive" },
                    },
                  },
                },
              },
              {
                domains: {
                  some: {
                    name: { equals: query, mode: "insensitive" },
                  },
                },
              },
              {
                subscription: {
                  some: {
                    id: { equals: query, mode: "insensitive" },
                  },
                },
              },
            ],
          },
          select: teamAdminSelection,
        });
      }

      return team ?? null;
    }),

  listTeams: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, query } = input;
      const skip = (page - 1) * pageSize;

      const numericId = query && /^\d+$/.test(query) ? Number(query) : null;
      const where: Prisma.TeamWhereInput = query
        ? {
          OR: [
            ...(numericId ? [{ id: numericId }] : []),
            { name: { contains: query, mode: "insensitive" } },
            { billingEmail: { contains: query, mode: "insensitive" } },
            {
              teamUsers: {
                some: {
                  user: { email: { contains: query, mode: "insensitive" } },
                },
              },
            },
            { domains: { some: { name: { contains: query, mode: "insensitive" } } } },
            { subscription: { some: { id: { equals: query } } } },
          ],
        }
        : {};

      const [teams, total] = await Promise.all([
        db.team.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: teamAdminSelection,
        }),
        db.team.count({ where }),
      ]);

      return { teams, total, page, pageSize };
    }),

  updateTeamSettings: adminProcedure
    .input(
      z.object({
        teamId: z.number(),
        apiRateLimit: z.number().int().min(-1).max(10_000),
        dailyEmailLimit: z.number().int().min(-1).max(10_000_000),
        isBlocked: z.boolean(),
        plan: z.enum(["FREE", "HOBBY", "LITE", "BASIC", "SCALE", "LIFETIME"]),
        extraDomainSlots: z.number().int().min(0).max(1_000).optional(),
        extraMemberSlots: z.number().int().min(0).max(1_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId, ...data } = input;

      const existingTeam = await db.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          apiRateLimit: true,
          dailyEmailLimit: true,
          isBlocked: true,
          plan: true,
          extraDomainSlots: true,
          extraMemberSlots: true,
        },
      });

      if (!existingTeam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      const updatedTeam = await db.team.update({
        where: { id: teamId },
        data,
        select: teamAdminSelection,
      });

      await TeamService.invalidateTeamCache(teamId);

      const changes = diffFields(existingTeam, data);
      if (Object.keys(changes).length > 0) {
        await AdminAuditService.record({
          actor: actorFrom(ctx),
          action: "team.settings.update",
          targetType: "team",
          targetId: teamId,
          metadata: { teamName: existingTeam.name, changes } as Prisma.InputJsonObject,
        });
      }

      return updatedTeam;
    }),

  adminAssignPlan: adminProcedure
    .input(
      z.object({
        teamId: z.number(),
        plan: z.enum(["FREE", "HOBBY", "LITE", "BASIC", "SCALE", "LIFETIME"]),
        method: z.enum(["complimentary", "checkout_link"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { teamId, plan, method } = input;

      if (!isCloud()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Plan assignment is only available in the cloud deployment",
        });
      }

      if (method === "complimentary") {
        const updatedTeam = await db.team.update({
          where: { id: teamId },
          data: {
            plan,
            isActive: plan !== "FREE",
            customPlanEnabled: false,
            customMarketingEmailLimit: null,
            customTransactionalEmailLimit: null,
            customMonthlyPriceCents: null,
          },
          select: teamAdminSelection,
        });
        await TeamService.invalidateTeamCache(teamId);
        logger.info(
          { teamId, plan, method: "complimentary" },
          "[AdminRouter]: Plan assigned complimentarily",
        );
        await AdminAuditService.record({
          actor: actorFrom(ctx),
          action: "team.plan.assign",
          targetType: "team",
          targetId: teamId,
          metadata: { teamName: updatedTeam.name, plan },
        });
        return { method: "complimentary" as const, team: updatedTeam, url: null };
      }

      if (plan === "FREE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot generate a checkout link for the FREE plan",
        });
      }

      const session = await createCheckoutSessionForTeam(teamId, plan as CheckoutPlan);
      logger.info(
        { teamId, plan, sessionId: session.id },
        "[AdminRouter]: Checkout session created for team",
      );
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "team.plan.checkout_link",
        targetType: "team",
        targetId: teamId,
        metadata: { plan, checkoutSessionId: session.id },
      });
      return { method: "checkout_link" as const, team: null, url: session.url };
    }),

  listAdminDomains: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, query } = input;
      const skip = (page - 1) * pageSize;

      const where: Prisma.DomainWhereInput = query
        ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { region: { contains: query, mode: "insensitive" } },
            { team: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
        : {};

      const [domains, total] = await Promise.all([
        db.domain.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: adminDomainSelection,
        }),
        db.domain.count({ where }),
      ]);

      return { domains, total, page, pageSize };
    }),

  listAdminWebhooks: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, query } = input;
      const skip = (page - 1) * pageSize;

      const where: Prisma.WebhookWhereInput = query
        ? {
          OR: [
            { url: { contains: query, mode: "insensitive" } },
            { team: { name: { contains: query, mode: "insensitive" } } },
            { createdBy: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
        : {};

      const [webhooks, total] = await Promise.all([
        db.webhook.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: adminWebhookSelection,
        }),
        db.webhook.count({ where }),
      ]);

      return { webhooks, total, page, pageSize };
    }),

  listAdminBilling: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        query: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, query } = input;
      const skip = (page - 1) * pageSize;

      const where: Prisma.TeamWhereInput = query
        ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { billingEmail: { contains: query, mode: "insensitive" } },
            { stripeCustomerId: { contains: query, mode: "insensitive" } },
            {
              subscription: {
                some: {
                  id: { contains: query, mode: "insensitive" },
                },
              },
            },
          ],
        }
        : {};

      const [teams, total] = await Promise.all([
        db.team.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            plan: true,
            isActive: true,
            isBlocked: true,
            billingEmail: true,
            stripeCustomerId: true,
            createdAt: true,
            subscription: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                cancelAtPeriodEnd: true,
                createdAt: true,
              },
            },
          },
        }),
        db.team.count({ where }),
      ]);

      return { teams, total, page, pageSize };
    }),

  adminForceVerifyDomain: adminProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: { id: true, name: true, status: true, teamId: true },
      });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }
      const updated = await db.domain.update({
        where: { id: input.domainId },
        data: {
          status: "SUCCESS",
          isVerifying: false,
          errorMessage: null,
        },
        select: adminDomainSelection,
      });
      logger.info({ domainId: input.domainId }, "[AdminRouter]: Domain force-verified");
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "domain.force_verify",
        targetType: "domain",
        targetId: input.domainId,
        metadata: { domainName: domain.name, teamId: domain.teamId, previousStatus: domain.status },
      });
      return updated;
    }),

  adminDeleteDomain: adminProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: { id: true, name: true, teamId: true, region: true },
      });
      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
      }
      await db.domain.delete({ where: { id: input.domainId } });
      logger.info({ domainId: input.domainId }, "[AdminRouter]: Domain deleted by admin");
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "domain.delete",
        targetType: "domain",
        targetId: input.domainId,
        metadata: { domainName: domain.name, teamId: domain.teamId, region: domain.region },
      });
      return { success: true };
    }),

  adminDeleteTeam: adminProcedure
    .input(z.object({ teamId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const team = await db.team.findUnique({
        where: { id: input.teamId },
        select: { id: true, name: true, plan: true },
      });
      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }
      await db.team.delete({ where: { id: input.teamId } });
      logger.info({ teamId: input.teamId, teamName: team.name }, "[AdminRouter]: Team deleted by admin");
      await AdminAuditService.record({
        actor: actorFrom(ctx),
        action: "team.delete",
        targetType: "team",
        targetId: input.teamId,
        metadata: { teamName: team.name, plan: team.plan },
      });
      return { success: true };
    }),

  getEmailAnalytics: adminProcedure
    .input(
      z.object({
        timeframe: z.enum(["today", "thisMonth"]),
        paidOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const timeframe = input.timeframe;
      const paidOnly = input.paidOnly ?? false;

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const monthStartDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const monthStart = monthStartDate.toISOString().slice(0, 10);

      type EmailAnalyticsRow = {
        teamId: number;
        name: string;
        plan: Plan;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        complained: number;
        hardBounced: number;
      };

      const rows = await db.$queryRaw<Array<EmailAnalyticsRow>>`
        SELECT
          d."teamId" AS "teamId",
          t."name" AS name,
          t."plan" AS plan,
          SUM(d.sent)::integer AS sent,
          SUM(d.delivered)::integer AS delivered,
          SUM(d.opened)::integer AS opened,
          SUM(d.clicked)::integer AS clicked,
          SUM(d.bounced)::integer AS bounced,
          SUM(d.complained)::integer AS complained,
          SUM(d."hardBounced")::integer AS "hardBounced"
        FROM "DailyEmailUsage" d
        INNER JOIN "Team" t ON t.id = d."teamId"
        WHERE 1 = 1
        ${timeframe === "today"
          ? Prisma.sql`AND d."date" = ${today}`
          : Prisma.sql`AND d."date" >= ${monthStart}`
        }
        ${paidOnly ? Prisma.sql`AND t."plan" <> 'FREE'` : Prisma.sql``}
        GROUP BY d."teamId", t."name", t."plan"
        ORDER BY sent DESC
      `;

      const totals = rows.reduce(
        (acc, row) => {
          acc.sent += row.sent;
          acc.delivered += row.delivered;
          acc.opened += row.opened;
          acc.clicked += row.clicked;
          acc.bounced += row.bounced;
          acc.complained += row.complained;
          acc.hardBounced += row.hardBounced;
          return acc;
        },
        {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
          hardBounced: 0,
        },
      );

      return {
        rows,
        totals,
        timeframe,
        paidOnly,
        periodStart: timeframe === "today" ? today : monthStart,
      };
    }),
});
