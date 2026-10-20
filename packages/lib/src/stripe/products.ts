import { PlanType, StripeProductConfig } from "./types";
import { PLANS } from "./plans";

/**
 * Stripe Product Configuration
 * Maps our internal plans to Stripe products and pricing
 */

export const STRIPE_PRODUCTS: Record<PlanType, StripeProductConfig> = {
  FREE: {
    plan: "FREE",
    name: "ByteSend Free",
    description:
      "Everything you need to start sending. 5,000 emails/month and 200/day included (hard cap).",
  },

  HOBBY: {
    plan: "HOBBY",
    name: "ByteSend Starter",
    description:
      "For side projects and small apps. 25,000 emails/month included, no daily cap. " +
      "Extra emails $0.40 per 1,000 transactional and $0.70 per 1,000 marketing.",
    priceMonthly: 500,
  },

  // Legacy: kept so existing subscribers resolve; not sold or re-seeded.
  LITE: {
    plan: "LITE",
    name: "ByteSend Lite",
    description: "Legacy plan. 50,000 emails/month included.",
    priceMonthly: 1000,
  },

  BASIC: {
    plan: "BASIC",
    name: "ByteSend Pro",
    description:
      "For growing products and teams. 100,000 emails/month included, no daily cap. " +
      "Extra emails $0.35 per 1,000 transactional and $0.60 per 1,000 marketing.",
    priceMonthly: 2000,
  },

  SCALE: {
    plan: "SCALE",
    name: "ByteSend Scale",
    description:
      "For high-volume senders. 500,000 emails/month included, no daily cap. " +
      "Extra emails $0.30 per 1,000 transactional and $0.50 per 1,000 marketing.",
    priceMonthly: 9000,
  },

  // Legacy: kept so existing purchases resolve; not sold or re-seeded.
  LIFETIME: {
    plan: "LIFETIME",
    name: "ByteSend Lifetime",
    description: "Legacy one-time plan. 500,000 emails/month included.",
    priceOneTime: 19900,
  },
};

/**
 * Add-on product configurations (not tied to a plan)
 */
export const STRIPE_ADDON_PRODUCTS = {
  EXTRA_MEMBER: {
    name: "ByteSend Extra Team Member",
    description:
      "Add-on for team members beyond the included plan limit. $2 per additional member per month.",
    priceMonthly: 200,
  },
  ADDITIONAL_DOMAIN: {
    name: "ByteSend Additional Domain",
    description:
      "An additional sending domain, $1 per domain per month.",
    priceMonthly: 100,
  },
} as const;

/**
 * Get Stripe product config by plan
 */
export function getProductConfig(plan: PlanType): StripeProductConfig {
  return STRIPE_PRODUCTS[plan];
}

/**
 * Get all product configs
 */
export function getAllProductConfigs(): StripeProductConfig[] {
  return Object.values(STRIPE_PRODUCTS);
}

/**
 * Stripe environment variable names mapping
 */
export const STRIPE_ENV_KEYS = {
  FREE: {
    productId: "STRIPE_FREE_PRODUCT_ID",
    // No metered prices — FREE plan is hard-capped, no Stripe metering
  },
  LITE: {
    productId: "STRIPE_LITE_PRODUCT_ID",
    monthlyPrice: "STRIPE_LITE_PRICE_ID",
    marketingUsagePrice: "STRIPE_LITE_MARKETING_USAGE_PRICE_ID",
    transactionalUsagePrice: "STRIPE_LITE_TRANSACTIONAL_USAGE_PRICE_ID",
  },
  HOBBY: {
    productId: "STRIPE_HOBBY_PRODUCT_ID",
    monthlyPrice: "STRIPE_HOBBY_PRICE_ID",
    marketingUsagePrice: "STRIPE_HOBBY_MARKETING_USAGE_PRICE_ID",
    transactionalUsagePrice: "STRIPE_HOBBY_TRANSACTIONAL_USAGE_PRICE_ID",
  },
  BASIC: {
    productId: "STRIPE_BASIC_PRODUCT_ID",
    monthlyPrice: "STRIPE_BASIC_PRICE_ID",
    marketingUsagePrice: "STRIPE_BASIC_MARKETING_USAGE_PRICE_ID",
    transactionalUsagePrice: "STRIPE_BASIC_TRANSACTIONAL_USAGE_PRICE_ID",
  },
  SCALE: {
    productId: "STRIPE_SCALE_PRODUCT_ID",
    monthlyPrice: "STRIPE_SCALE_PRICE_ID",
    marketingUsagePrice: "STRIPE_SCALE_MARKETING_USAGE_PRICE_ID",
    transactionalUsagePrice: "STRIPE_SCALE_TRANSACTIONAL_USAGE_PRICE_ID",
  },
  LIFETIME: {
    productId: "STRIPE_LIFETIME_PRODUCT_ID",
    oneTimePrice: "STRIPE_LIFETIME_PRICE_ID",
    // No metered prices — LIFETIME is unlimited
  },
  // Add-on products
  EXTRA_MEMBER: {
    productId: "STRIPE_EXTRA_MEMBER_PRODUCT_ID",
    monthlyPrice: "STRIPE_EXTRA_MEMBER_PRICE_ID",
  },
  ADDITIONAL_DOMAIN: {
    productId: "STRIPE_ADDITIONAL_DOMAIN_PRODUCT_ID",
    monthlyPrice: "STRIPE_ADDITIONAL_DOMAIN_PRICE_ID",
  },
} as const;
