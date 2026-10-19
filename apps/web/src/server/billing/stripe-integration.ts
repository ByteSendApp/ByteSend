import { env } from "~/env";
import { PLANS, getPlan, PlanType } from "@bytesend/lib";

const PLAN_ENV_MAP: Record<PlanType, { monthly?: string; marketingUsage?: string; transactionalUsage?: string; oneTime?: string }> = {
  FREE: {},
  LITE: {
    monthly: env.STRIPE_LITE_PRICE_ID,
    marketingUsage: env.STRIPE_LITE_MARKETING_USAGE_PRICE_ID,
    transactionalUsage: env.STRIPE_LITE_TRANSACTIONAL_USAGE_PRICE_ID,
  },
  HOBBY: {
    monthly: env.STRIPE_HOBBY_PRICE_ID,
    marketingUsage: env.STRIPE_HOBBY_MARKETING_USAGE_PRICE_ID,
    transactionalUsage: env.STRIPE_HOBBY_TRANSACTIONAL_USAGE_PRICE_ID,
  },
  BASIC: {
    monthly: env.STRIPE_BASIC_PRICE_ID,
    marketingUsage: env.STRIPE_BASIC_MARKETING_USAGE_PRICE_ID,
    transactionalUsage: env.STRIPE_BASIC_TRANSACTIONAL_USAGE_PRICE_ID,
  },
  LIFETIME: {
    oneTime: env.STRIPE_LIFETIME_PRICE_ID,
  },
};

export function getPlanPriceIds(plan: PlanType): { monthly?: string; marketingUsage?: string; transactionalUsage?: string; oneTime?: string } {
  return PLAN_ENV_MAP[plan];
}

export function getMonthlyPriceId(plan: PlanType): string | undefined {
  return PLAN_ENV_MAP[plan]?.monthly;
}

export function getMarketingUsagePriceId(plan: PlanType): string | undefined {
  return PLAN_ENV_MAP[plan]?.marketingUsage;
}

export function getTransactionalUsagePriceId(plan: PlanType): string | undefined {
  return PLAN_ENV_MAP[plan]?.transactionalUsage;
}

export function getOneTimePriceId(plan: PlanType): string | undefined {
  return PLAN_ENV_MAP[plan]?.oneTime;
}

export function getBillingTierInfo(plan: PlanType) {
  const tier = getPlan(plan);
  return {
    name: tier.displayName,
    description: tier.description,
    monthlyPrice: tier.monthlyPrice / 100,
    isLimited: tier.isLimited,
    limits: tier.limits,
  };
}

export function getAvailableBillingTiers() {
  return Object.values(PLANS)
    .sort((a, b) => a.order - b.order)
    .map(tier => ({
      plan: tier.plan,
      name: tier.displayName,
      description: tier.description,
      monthlyPrice: tier.monthlyPrice / 100,
      annualPrice: tier.annualPrice ? tier.annualPrice / 100 : undefined,
      isLimited: tier.isLimited,
      limits: tier.limits,
      usageMetering: tier.usageMetering,
    }));
}

export function formatPlanPrice(plan: PlanType): string {
  const pricing = getPlan(plan);

  if (plan === "FREE") {
    return "Free";
  }

  if (plan === "LIFETIME") {
    return `CA$${((pricing.oneTimePrice ?? 0) / 100).toFixed(0)} one-time`;
  }

  if (plan === "BASIC") {
    return `CA$${(pricing.monthlyPrice / 100).toFixed(2)}/mo`;
  }

  return `CA$${(pricing.monthlyPrice / 100).toFixed(2)}/mo`;
}

export function getMeterRates(plan: PlanType = "LITE") {
  const planData = getPlan(plan);
  return planData.usageMetering ?? null;
}

export function shouldShowPlanInUI(plan: PlanType): boolean {
  return plan !== "HOBBY";
}

export function getRecommendedPlan(monthlyEmails: number): PlanType {
  if (monthlyEmails <= 5000) {
    return "FREE";
  }
  if (monthlyEmails <= 50000) {
    return "LITE";
  }
  return "BASIC";
}
