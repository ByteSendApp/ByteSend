import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as tldts from "tldts";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  checkDmarcRecord,
  DMARC_RETENTION_DAYS,
  DMARC_TAG,
  getDmarcSummary,
  hostedDmarcAddress,
} from "~/server/service/dmarc-service";
import { ensureInboundSlug } from "~/server/service/inbound-service";
import { isInboundEnabled } from "~/server/service/inbound-storage";
import { receivingFqdn } from "~/server/service/inbound-domain-service";

const PAGE_SIZE = 25;
const DAYS = z.union([z.literal(7), z.literal(30), z.literal(90)]);

async function reportAddresses(teamId: number) {
  const slug = await ensureInboundSlug(teamId);
  const receiving = await db.domain.findMany({
    where: { teamId, inboundEnabled: true, inboundStatus: "SUCCESS" },
    select: { name: true, inboundSubdomain: true },
  });
  return {
    hosted: hostedDmarcAddress(slug),
    byOrgDomain: new Map(
      receiving.map((d) => [tldts.getDomain(d.name) ?? d.name, `${DMARC_TAG}@${receivingFqdn(d)}`] as const),
    ),
  };
}

export const dmarcRouter = createTRPCRouter({
  setup: teamProcedure.query(async ({ ctx }) => {
    const enabled = isInboundEnabled();
    const domains = await db.domain.findMany({
      where: { teamId: ctx.team.id, status: "SUCCESS" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (!enabled) return { enabled, hostedAddress: null, retentionDays: DMARC_RETENTION_DAYS, domains: [] };

    const addresses = await reportAddresses(ctx.team.id);
    const orgDomains = [...new Set(domains.map((d) => tldts.getDomain(d.name) ?? d.name))];
    const checks = await Promise.all(
      orgDomains.map(async (orgDomain) => {
        const address = addresses.byOrgDomain.get(orgDomain) ?? addresses.hosted;
        const check = await checkDmarcRecord(orgDomain, address);
        return {
          ...check,
          address,
          sendingDomains: domains.filter((d) => (tldts.getDomain(d.name) ?? d.name) === orgDomain).map((d) => d.name),
        };
      }),
    );
    return { enabled, hostedAddress: addresses.hosted, retentionDays: DMARC_RETENTION_DAYS, domains: checks };
  }),

  summary: teamProcedure
    .input(z.object({ days: DAYS.default(30), domain: z.string().trim().toLowerCase().max(253).optional() }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      return getDmarcSummary(ctx.team.id, since, input.domain || undefined);
    }),

  reports: teamProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        days: DAYS.default(30),
        domain: z.string().trim().toLowerCase().max(253).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        teamId: ctx.team.id,
        endAt: { gte: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000) },
        ...(input.domain ? { domain: input.domain } : {}),
      };
      const [reports, total] = await Promise.all([
        db.dmarcReport.findMany({
          where,
          select: {
            id: true,
            domain: true,
            orgName: true,
            beginAt: true,
            endAt: true,
            messageCount: true,
            passCount: true,
            _count: { select: { records: true } },
          },
          orderBy: { endAt: "desc" },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        db.dmarcReport.count({ where }),
      ]);
      return { reports, total, pageSize: PAGE_SIZE };
    }),

  report: teamProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const report = await db.dmarcReport.findFirst({
      where: { id: input.id, teamId: ctx.team.id },
      select: {
        id: true,
        domain: true,
        orgName: true,
        reporterEmail: true,
        reportId: true,
        beginAt: true,
        endAt: true,
        policy: true,
        messageCount: true,
        passCount: true,
        records: {
          select: {
            id: true,
            sourceIp: true,
            sourceHost: true,
            count: true,
            disposition: true,
            dkim: true,
            spf: true,
            headerFrom: true,
            envelopeFrom: true,
            dkimResults: true,
            spfResults: true,
            viaByteSend: true,
          },
          orderBy: { count: "desc" },
        },
      },
    });
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
    return report;
  }),
});
