import { DailyEmailUsage, EmailUsageType, Subscription } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { format, sub } from "date-fns";
import { z } from "zod";
import { getThisMonthUsage } from "~/server/service/usage-service";

import {
  apiKeyProcedure,
  createTRPCRouter,
  teamAdminProcedure,
  teamProcedure,
} from "~/server/api/trpc";
import {
  createCheckoutSessionForTeam,
  createCustomCheckoutSessionForTeam,
  createAddonCheckoutSession,
  getManageSessionUrl,
  syncStripeData,
  type CheckoutPlan,
  type CustomBasePlan,
} from "~/server/billing/payments";
import { db } from "~/server/db";
import { TeamService } from "~/server/service/team-service";

const checkoutPlanSchema = z.enum(["HOBBY", "BASIC", "SCALE"]);

export const billingRouter = createTRPCRouter({
  createCheckoutSession: teamAdminProcedure
    .input(
      z
        .object({ plan: checkoutPlanSchema })
        .optional()
        .default({ plan: "BASIC" })
    )
    .mutation(async ({ ctx, input }) => {
      return (
        await createCheckoutSessionForTeam(
          ctx.team.id,
          input.plan as CheckoutPlan
        )
      ).url;
    }),

  createCustomCheckoutSession: teamAdminProcedure
    .input(
      z.object({
        plan: z.enum(["HOBBY", "BASIC", "SCALE"]),
        marketingEmailLimit: z.number().int().min(1000).max(3000000),
        transactionalEmailLimit: z.number().int().min(1000).max(3000000),
        monthlyPriceCents: z.number().int().min(100).max(50000000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await createCustomCheckoutSessionForTeam(ctx.team.id, {
        basePlan: input.plan as CustomBasePlan,
        marketingEmailLimit: input.marketingEmailLimit,
        transactionalEmailLimit: input.transactionalEmailLimit,
        monthlyPriceCents: input.monthlyPriceCents,
      });
      return session.url;
    }),

  /**
   * Purchase extra domain slots at $1/domain/month.
   * Available on all plans including FREE.
   */
  purchaseAddonDomainSlots: teamAdminProcedure
    .input(z.object({ quantity: z.number().int().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const session = await createAddonCheckoutSession(ctx.team.id, input.quantity);
      return session.url;
    }),

  /**
   * Purchase extra team member slots at $2/member/month.
   * Available on all plans including FREE.
   */
  purchaseAddonMemberSlots: teamAdminProcedure
    .input(z.object({ quantity: z.number().int().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const session = await createAddonCheckoutSession(ctx.team.id, input.quantity, "EXTRA_MEMBER");
      return session.url;
    }),

  getManageSessionUrl: teamAdminProcedure.mutation(async ({ ctx }) => {
    return await getManageSessionUrl(ctx.team.id);
  }),

  getThisMonthUsage: teamProcedure.query(async ({ ctx }) => {
    return await getThisMonthUsage(ctx.team.id);
  }),

  getSubscriptionDetails: teamProcedure.query(async ({ ctx }) => {
    const subscription = await db.subscription.findFirst({
      where: { teamId: ctx.team.id },
      orderBy: { status: "asc" },
    });

    return subscription;
  }),

  getCustomPlanContract: teamProcedure.query(async ({ ctx }) => {
    const team = await db.team.findUnique({
      where: { id: ctx.team.id },
      select: {
        customPlanEnabled: true,
        customMarketingEmailLimit: true,
        customTransactionalEmailLimit: true,
        customMonthlyPriceCents: true,
      },
    });

    return team;
  }),

  updateBillingEmail: teamAdminProcedure
    .input(
      z.object({
        billingEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { billingEmail } = input;

      await TeamService.updateTeam(ctx.team.id, { billingEmail });
    }),

  /**
   * Manually pull the latest subscription state from Stripe and update the DB.
   * Used on the payment success page when the webhook may have been missed.
   */
  syncSubscription: teamProcedure.mutation(async ({ ctx }) => {
    const team = await db.team.findUnique({ where: { id: ctx.team.id } });
    if (!team?.stripeCustomerId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No Stripe customer found for this team" });
    }
    await syncStripeData(team.stripeCustomerId);
    const updated = await db.team.findUnique({ where: { id: ctx.team.id } });
    return { plan: updated?.plan ?? "FREE", isActive: updated?.isActive ?? false };
  }),
});
