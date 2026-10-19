import { SuppressionReason } from "@prisma/client";
import { z } from "zod";

import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { SuppressionService } from "~/server/service/suppression-service";

export const suppressionRouter = createTRPCRouter({
  getSuppressions: teamProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        reason: z.nativeEnum(SuppressionReason).optional().nullable(),
        sortBy: z.enum(["email", "reason", "createdAt"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search, reason, sortBy, sortOrder } = input;

      const result = await SuppressionService.getSuppressionList({
        teamId: ctx.team.id,
        page,
        limit,
        search,
        reason,
        sortBy,
        sortOrder,
      });

      return {
        suppressions: result.suppressions,
        pagination: {
          page,
          limit,
          totalCount: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1,
        },
      };
    }),

  addSuppression: teamProcedure
    .input(
      z.object({
        email: z.string().email(),
        reason: z
          .nativeEnum(SuppressionReason)
          .default(SuppressionReason.MANUAL),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return SuppressionService.addSuppression({
        email: input.email,
        teamId: ctx.team.id,
        reason: input.reason,
      });
    }),

  removeSuppression: teamProcedure
    .input(
      z.object({
        email: z.string().trim().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await SuppressionService.removeSuppression(input.email, ctx.team.id);
    }),

  bulkAddSuppressions: teamProcedure
    .input(
      z.object({
        emails: z.array(z.string().email()).max(1000),
        reason: z
          .nativeEnum(SuppressionReason)
          .default(SuppressionReason.MANUAL),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return SuppressionService.addMultipleSuppressions(
        ctx.team.id,
        input.emails,
        input.reason
      );
    }),

  checkSuppression: teamProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .query(async ({ ctx, input }) => {
      return SuppressionService.isEmailSuppressed(input.email, ctx.team.id);
    }),

  checkMultipleSuppressions: teamProcedure
    .input(
      z.object({
        emails: z.array(z.string().email()).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      return SuppressionService.checkMultipleEmails(input.emails, ctx.team.id);
    }),

  getSuppressionStats: teamProcedure.query(async ({ ctx }) => {
    return SuppressionService.getSuppressionStats(ctx.team.id);
  }),

  exportSuppressions: teamProcedure
    .input(
      z.object({
        reason: z.nativeEnum(SuppressionReason).optional().nullable(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await SuppressionService.getSuppressionList({
        teamId: ctx.team.id,
        page: 1,
        limit: 10000,
        search: input.search,
        reason: input.reason,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      return result.suppressions.map((suppression) => ({
        email: suppression.email,
        reason: suppression.reason,
        source: suppression.source,
        createdAt: suppression.createdAt.toISOString(),
      }));
    }),
});
