import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { createTRPCRouter, teamAdminProcedure, teamProcedure } from "~/server/api/trpc";
import { inboundMxHost } from "~/server/aws/ses-receiving";
import {
  ensureInboundSlug,
  getInboundUsage,
  hostedAddress,
  INBOUND_RETENTION_DAYS,
  toReceivedPayload,
} from "~/server/service/inbound-service";
import {
  checkReceiving,
  currentMailHosts,
  disableReceiving,
  enableReceiving,
  receivingFqdn,
  receivingRecords,
  RECEIVING_DOMAIN_SELECT,
} from "~/server/service/inbound-domain-service";
import { getInboundStore, isInboundEnabled } from "~/server/service/inbound-storage";
import { attachmentsOf } from "~/server/service/inbound-service";

const PAGE_SIZE = 25;
const EMAIL = z.string().trim().toLowerCase().email();

function assertEnabled() {
  if (!isInboundEnabled()) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Receiving email isn't set up on this ByteSend instance." });
  }
}

export const inboundRouter = createTRPCRouter({
  overview: teamProcedure.query(async ({ ctx }) => {
    const enabled = isInboundEnabled();
    if (!enabled) return { enabled, hostedAddress: null, usage: null, region: env.INBOUND_REGION, mxHost: inboundMxHost(), retentionDays: INBOUND_RETENTION_DAYS };
    const slug = await ensureInboundSlug(ctx.team.id);
    return {
      enabled,
      hostedAddress: hostedAddress(slug),
      usage: await getInboundUsage(ctx.team.id),
      region: env.INBOUND_REGION,
      mxHost: inboundMxHost(),
      retentionDays: INBOUND_RETENTION_DAYS,
    };
  }),

  list: teamProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), search: z.string().trim().max(200).optional(), domainId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const where = {
        teamId: ctx.team.id,
        ...(input.domainId ? { domainId: input.domainId } : {}),
        ...(input.search
          ? {
              OR: [
                { subject: { contains: input.search, mode: "insensitive" as const } },
                { from: { contains: input.search, mode: "insensitive" as const } },
                { recipient: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [emails, total] = await Promise.all([
        ctx.db.inboundEmail.findMany({
          where,
          orderBy: { receivedAt: "desc" },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            from: true,
            fromName: true,
            recipient: true,
            subject: true,
            text: true,
            status: true,
            attachments: true,
            spamVerdict: true,
            virusVerdict: true,
            inReplyToEmailId: true,
            receivedAt: true,
          },
        }),
        ctx.db.inboundEmail.count({ where }),
      ]);
      return {
        emails: emails.map(({ attachments, text, ...email }) => ({
          ...email,
          preview: (text ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
          attachmentCount: attachmentsOf({ attachments }).length,
        })),
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      };
    }),

  get: teamProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const email = await ctx.db.inboundEmail.findFirst({ where: { id: input.id, teamId: ctx.team.id } });
    if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
    return {
      ...toReceivedPayload(email),
      status: email.status,
      error: email.error,
      forwardedTo: email.forwardedTo,
      size: email.size,
      headers: email.headers as Array<{ name: string; value: string }>,
      expiresAt: email.expiresAt,
    };
  }),

  delete: teamProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const email = await ctx.db.inboundEmail.findFirst({
      where: { id: input.id, teamId: ctx.team.id },
      select: { id: true, rawKey: true, attachments: true },
    });
    if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
    await getInboundStore().remove([...(email.rawKey ? [email.rawKey] : []), ...attachmentsOf(email).map((a) => a.key)]);
    await ctx.db.inboundEmail.delete({ where: { id: email.id } });
    return { success: true };
  }),

  mailHosts: teamProcedure
    .input(z.object({ domainId: z.number().int() }))
    .query(({ ctx, input }) => currentMailHosts(ctx.team.id, input.domainId)),

  domains: teamProcedure.query(async ({ ctx }) => {
    const domains = await ctx.db.domain.findMany({ where: { teamId: ctx.team.id }, select: RECEIVING_DOMAIN_SELECT, orderBy: { name: "asc" } });
    return domains.map((domain) => ({ ...domain, address: receivingFqdn(domain), records: receivingRecords(domain) }));
  }),

  enableDomain: teamAdminProcedure
    .input(z.object({ domainId: z.number().int(), subdomain: z.string().max(63), confirmRoot: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      assertEnabled();
      const domain = await enableReceiving(ctx.team.id, input.domainId, input.subdomain, input.confirmRoot);
      return { ...domain, address: receivingFqdn(domain), records: receivingRecords(domain) };
    }),

  checkDomain: teamProcedure.input(z.object({ domainId: z.number().int() })).mutation(async ({ ctx, input }) => {
    assertEnabled();
    const result = await checkReceiving(ctx.team.id, input.domainId);
    return { ...result, records: receivingRecords(result.domain) };
  }),

  disableDomain: teamAdminProcedure.input(z.object({ domainId: z.number().int() })).mutation(async ({ ctx, input }) => {
    await disableReceiving(ctx.team.id, input.domainId);
    return { success: true };
  }),

  rules: teamProcedure.query(({ ctx }) =>
    ctx.db.inboundForwardRule.findMany({
      where: { teamId: ctx.team.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, match: true, forwardTo: true, enabled: true, createdAt: true },
    }),
  ),

  createRule: teamAdminProcedure
    .input(
      z.object({
        match: z
          .string()
          .trim()
          .toLowerCase()
          .min(1)
          .max(254)
          .refine((v) => v === "*" || /^[a-z0-9._%+-]+(@[a-z0-9.-]+\.[a-z]{2,})?$/.test(v), "Use an address, a name before the @, or * for everything"),
        forwardTo: EMAIL,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.inboundForwardRule.count({ where: { teamId: ctx.team.id } });
      if (count >= 50) throw new TRPCError({ code: "BAD_REQUEST", message: "A team can have up to 50 forwarding rules." });
      return ctx.db.inboundForwardRule.create({
        data: { teamId: ctx.team.id, match: input.match, forwardTo: input.forwardTo },
        select: { id: true },
      });
    }),

  setRuleEnabled: teamAdminProcedure.input(z.object({ id: z.string(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.inboundForwardRule.updateMany({ where: { id: input.id, teamId: ctx.team.id }, data: { enabled: input.enabled } });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
    return { success: true };
  }),

  deleteRule: teamAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.inboundForwardRule.deleteMany({ where: { id: input.id, teamId: ctx.team.id } });
    return { success: true };
  }),
});
