import { z } from "zod";

import {
  createTRPCRouter,
  teamProcedure,
  protectedProcedure,
  domainProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  createDomain,
  deleteDomain,
  getDomain,
  getDomains,
  updateDomain,
  reregisterDomainDkim,
  clearDkimReregisteredFlag,
} from "~/server/service/domain-service";
import { sendEmail } from "~/server/service/email-service";
import { DomainRegionService, getRegionMoveSummary } from "~/server/service/domain-region-service";
import { SesSettingsService } from "~/server/service/ses-settings-service";
import { env } from "~/env";
import { LimitService } from "~/server/service/limit-service";
import { TRPCError } from "@trpc/server";
import { CloudflareError, setUpDomainOnCloudflare } from "~/server/service/cloudflare-dns-service";

function assertTeamAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only team admins can change a domain's region" });
  }
}

function isAdminOrFounder(email: string | null | undefined) {
  const adminEmails = [env.ADMIN_EMAIL, env.FOUNDER_EMAIL].filter(Boolean);
  return !!email && adminEmails.includes(email);
}

export const domainRouter = createTRPCRouter({
  getAvailableRegions: protectedProcedure.query(async () => {
    const settings = await SesSettingsService.getAllSettings();
    return settings.filter((s) => s.isActive).map((setting) => setting.region);
  }),

  createDomain: teamProcedure
    .input(z.object({ name: z.string(), region: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const limitCheck = await LimitService.checkDomainLimit(ctx.team.id);
      if (limitCheck.isLimitReached) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Domain limit reached. You have ${limitCheck.currentCount}/${limitCheck.limit} domains. Upgrade or purchase additional domain slots.`,
        });
      }

      const allowReserved = isAdminOrFounder(ctx.session.user.email);
      return createDomain(
        ctx.team.id,
        input.name,
        input.region,
        ctx.team.sesTenantId ?? undefined,
        allowReserved,
      );
    }),

  startVerification: domainProcedure.mutation(async ({ ctx, input }) => {
    await clearDkimReregisteredFlag(input.id);
    await ctx.db.domain.update({
      where: { id: input.id },
      data: { isVerifying: true },
    });
  }),

  setUpCloudflare: domainProcedure
    .input(z.object({ token: z.string().trim().min(20).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.teamUser.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only team admins can change a domain's DNS" });
      }
      try {
        const outcomes = await setUpDomainOnCloudflare(ctx.domain, input.token);
        if (outcomes.some((o) => o.status === "created" || o.status === "updated")) {
          await clearDkimReregisteredFlag(ctx.domain.id);
          await ctx.db.domain.update({ where: { id: ctx.domain.id }, data: { isVerifying: true } });
        }
        return outcomes;
      } catch (error) {
        if (error instanceof CloudflareError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        throw error;
      }
    }),

  domains: teamProcedure.query(async ({ ctx }) => {
    return getDomains(ctx.team.id);
  }),

  domainStats: teamProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = await ctx.db.dailyEmailUsage.groupBy({
      by: ["domainId"],
      where: { teamId: ctx.team.id, date: { gte: since } },
      _sum: { sent: true, delivered: true, hardBounced: true, complained: true },
    });
    return Object.fromEntries(
      rows.map((row) => [
        row.domainId,
        {
          sent: row._sum.sent ?? 0,
          delivered: row._sum.delivered ?? 0,
          hardBounced: row._sum.hardBounced ?? 0,
          complained: row._sum.complained ?? 0,
        },
      ]),
    ) as Record<number, { sent: number; delivered: number; hardBounced: number; complained: number }>;
  }),

  getDomain: domainProcedure.query(async ({ input, ctx }) => {
    const domain = await getDomain(input.id, ctx.team.id);
    return { ...domain, regionMove: getRegionMoveSummary(domain) };
  }),

  startRegionMove: domainProcedure
    .input(z.object({ region: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      assertTeamAdmin(ctx.teamUser.role);
      await DomainRegionService.start(ctx.domain, input.region);
      return { success: true };
    }),

  cancelRegionMove: domainProcedure.mutation(async ({ ctx }) => {
    assertTeamAdmin(ctx.teamUser.role);
    await DomainRegionService.cancel(ctx.domain);
    return { success: true };
  }),

  checkRegionMove: domainProcedure.mutation(async ({ ctx }) => {
    const result = await DomainRegionService.refresh(ctx.domain);
    return { switched: result.switched, dnsPrecheck: result.dnsPrecheck };
  }),

  updateDomain: domainProcedure
    .input(
      z.object({
        clickTracking: z.boolean().optional(),
        openTracking: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return updateDomain(input.id, {
        clickTracking: input.clickTracking,
        openTracking: input.openTracking,
      });
    }),

  deleteDomain: domainProcedure.mutation(async ({ input }) => {
    await deleteDomain(input.id);
    return { success: true };
  }),

  reregisterDkim: domainProcedure.mutation(async ({ input, ctx }) => {
    return reregisterDomainDkim(input.id, ctx.team.id);
  }),

  sendTestEmailFromDomain: domainProcedure.mutation(
    async ({
      ctx: {
        session: { user },
        team,
      },
      input,
    }) => {
      const domain = await db.domain.findFirst({
        where: { id: input.id, teamId: team.id },
      });

      if (!domain) {
        throw new Error("Domain not found");
      }

      if (!user.email) {
        throw new Error("User email not found");
      }

      return sendEmail({
        teamId: team.id,
        to: user.email,
        from: `hello@${domain.name}`,
        subject: "ByteSend test email",
        text: "hello,\n\nByteSend: email infrastructure that just works.\n\ncheck out https://bytesend.cloud",
        html: "<p>hello,</p><p>ByteSend: email infrastructure that just works.</p><p>check out <a href='https://bytesend.cloud'>bytesend.cloud</a></p>",
      });
    }
  ),
});
