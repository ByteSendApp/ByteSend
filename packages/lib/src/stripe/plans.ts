import { PricingTier, PlanType } from "./types";

/**
 * Plan Definitions
 *
 * Prices are in USD (cents), with set GBP and EUR equivalents that Stripe Checkout shows by
 * the customer's location. Overage rates are per email. LITE and LIFETIME are legacy: existing
 * customers keep them, but they aren't sold.
 */

export const PLANS: Record<PlanType, PricingTier> = {
  FREE: {
    plan: "FREE",
    displayName: "Free",
    description: "Everything you need to start sending",
    order: 1,
    isLimited: true,
    monthlyPrice: 0,
    limits: {
      monthlyEmailLimit: 5_000,
      dailyEmailLimit: 200,
      maxDomains: 2,
      maxContactBooks: 5,
      maxTeamMembers: 5,
      maxWebhooks: 3,
      contactsLimit: 100,
      campaignsLimit: 3,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      apiAccessLevel: "basic",
      concurrentConnections: 1,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200, // $2/member/month add-on
      additionalDomainRateCents: 100, // $1/domain/month add-on
      inboundEmailsPerMonth: 1_000,
    },
  },

  HOBBY: {
    plan: "HOBBY",
    displayName: "Starter",
    description: "For side projects and small apps",
    order: 2,
    isLimited: true,
    monthlyPrice: 500, // $5
    localMonthlyPrice: { gbp: 400, eur: 500 },
    usageMetering: { marketing: 0.0007, transactional: 0.0004 }, // $0.70 / $0.40 per 1,000
    localUsageMetering: {
      gbp: { marketing: 0.00055, transactional: 0.0003 },
      eur: { marketing: 0.00065, transactional: 0.00037 },
    },
    limits: {
      monthlyEmailLimit: 25_000,
      dailyEmailLimit: Number.POSITIVE_INFINITY,
      maxDomains: 4,
      maxContactBooks: 10,
      maxTeamMembers: 10,
      maxWebhooks: 5,
      contactsLimit: 200,
      campaignsLimit: 30,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      apiAccessLevel: "basic",
      concurrentConnections: 2,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200,
      additionalDomainRateCents: 100,
      inboundEmailsPerMonth: 10_000,
    },
  },

  LITE: {
    plan: "LITE",
    displayName: "Lite",
    description: "Legacy plan for existing customers",
    order: 3,
    isLimited: true,
    legacy: true,
    monthlyPrice: 1000,
    usageMetering: { marketing: 0.0008, transactional: 0.00035 },
    limits: {
      monthlyEmailLimit: 50_000,
      dailyEmailLimit: Number.POSITIVE_INFINITY,
      maxDomains: 6,
      maxContactBooks: 25,
      maxTeamMembers: 15,
      maxWebhooks: 10,
      contactsLimit: 300,
      campaignsLimit: 100,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: false,
      apiAccessLevel: "full",
      concurrentConnections: 5,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200,
      additionalDomainRateCents: 100,
      inboundEmailsPerMonth: 20_000,
    },
  },

  BASIC: {
    plan: "BASIC",
    displayName: "Pro",
    description: "For growing products and teams",
    order: 4,
    isLimited: true,
    monthlyPrice: 2000, // $20
    localMonthlyPrice: { gbp: 1600, eur: 1900 },
    usageMetering: { marketing: 0.0006, transactional: 0.00035 }, // $0.60 / $0.35 per 1,000
    localUsageMetering: {
      gbp: { marketing: 0.00048, transactional: 0.00028 },
      eur: { marketing: 0.00055, transactional: 0.00032 },
    },
    limits: {
      monthlyEmailLimit: 100_000,
      dailyEmailLimit: Number.POSITIVE_INFINITY,
      maxDomains: 12,
      maxContactBooks: 50,
      maxTeamMembers: 30,
      maxWebhooks: 25,
      contactsLimit: 1_000,
      campaignsLimit: 200,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: true,
      apiAccessLevel: "full",
      concurrentConnections: 10,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200,
      additionalDomainRateCents: 100,
      inboundEmailsPerMonth: 50_000,
    },
  },

  SCALE: {
    plan: "SCALE",
    displayName: "Scale",
    description: "For high-volume senders",
    order: 5,
    isLimited: true,
    monthlyPrice: 9000, // $90
    localMonthlyPrice: { gbp: 7200, eur: 8500 },
    usageMetering: { marketing: 0.0005, transactional: 0.0003 }, // $0.50 / $0.30 per 1,000
    localUsageMetering: {
      gbp: { marketing: 0.0004, transactional: 0.00024 },
      eur: { marketing: 0.00046, transactional: 0.00028 },
    },
    limits: {
      monthlyEmailLimit: 500_000,
      dailyEmailLimit: Number.POSITIVE_INFINITY,
      maxDomains: 30,
      maxContactBooks: 200,
      maxTeamMembers: 50,
      maxWebhooks: 50,
      contactsLimit: 10_000,
      campaignsLimit: 1_000,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: true,
      apiAccessLevel: "full",
      concurrentConnections: 20,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200,
      additionalDomainRateCents: 100,
      inboundEmailsPerMonth: 250_000,
    },
  },

  LIFETIME: {
    plan: "LIFETIME",
    displayName: "Lifetime",
    description: "Legacy one-time plan for existing customers",
    order: 6,
    isLimited: true,
    legacy: true,
    monthlyPrice: 0,
    oneTimePrice: 19900,
    // No usageMetering: no overage billing.
    limits: {
      monthlyEmailLimit: 500_000,
      dailyEmailLimit: Number.POSITIVE_INFINITY,
      maxDomains: 30,
      maxContactBooks: 200,
      maxTeamMembers: 100,
      maxWebhooks: 50,
      contactsLimit: 10_000,
      campaignsLimit: 1_000,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: true,
      apiAccessLevel: "full",
      concurrentConnections: 20,
      marketingEmailsIncluded: true,
      extraMemberRateCents: 200,
      additionalDomainRateCents: 100,
      inboundEmailsPerMonth: 250_000,
    },
  },
};

/** Paid plans currently sold, cheapest first. */
export const SOLD_PAID_PLANS = ["HOBBY", "BASIC", "SCALE"] as const satisfies readonly PlanType[];
export type SoldPaidPlan = (typeof SOLD_PAID_PLANS)[number];

/**
 * Get plan by type
 */
export function getPlan(plan: PlanType): PricingTier {
  return PLANS[plan];
}

/**
 * Get all plans sorted by order
 */
export function getAllPlans(): PricingTier[] {
  return Object.values(PLANS).sort((a, b) => a.order - b.order);
}

/**
 * Check if a plan is limited (has usage caps)
 */
export function isPlanLimited(plan: PlanType): boolean {
  return PLANS[plan].isLimited;
}

/**
 * Get plan pricing
 */
export function getPlanMonthlyPrice(plan: PlanType, billing: "monthly" | "annual" = "monthly"): number {
  const planConfig = PLANS[plan];
  return billing === "annual" && planConfig.annualPrice
    ? planConfig.annualPrice
    : planConfig.monthlyPrice;
}

/** @deprecated use getPlanMonthlyPrice */
export const getPlanPrice = getPlanMonthlyPrice;
