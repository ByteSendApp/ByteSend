/**
 * Stripe Payment Types
 * Defines all payment-related types for ByteSend's Stripe integration
 */

export type PlanType = "FREE" | "LITE" | "HOBBY" | "BASIC" | "SCALE" | "LIFETIME";

/** Currencies prices are offered in. USD is the base; Stripe Checkout shows GBP or EUR by location. */
export type Currency = "usd" | "gbp" | "eur";

export type OverageRates = {
  marketing: number; // per marketing email beyond the plan allowance
  transactional: number; // per transactional email beyond the plan allowance
};

export interface PlanLimits {
  monthlyEmailLimit: number;
  dailyEmailLimit: number;
  maxDomains: number;
  maxContactBooks: number;
  maxTeamMembers: number;
  maxWebhooks: number;
  contactsLimit: number;
  campaignsLimit: number;
  prioritySupport: boolean;
  customBranding: boolean;
  advancedAnalytics: boolean;
  apiAccessLevel: "basic" | "full";
  concurrentConnections: number;
  /** Whether marketing/campaign emails are available on this plan. False = marketing blocked entirely. */
  marketingEmailsIncluded: boolean;
  /** Per-member overage rate in cents when maxTeamMembers is exceeded. 0 = hard cap (no overage). */
  extraMemberRateCents: number;
  /** Rate in cents to order an additional domain. 0 = not applicable. */
  additionalDomainRateCents: number;
}

export interface PricingTier {
  plan: PlanType;
  displayName: string;
  description: string;
  limits: PlanLimits;
  /** Monthly recurring price in USD cents. 0 for free or one-time plans. */
  monthlyPrice: number;
  /** The same monthly price in other currencies, in their minor units. */
  localMonthlyPrice?: Partial<Record<Exclude<Currency, "usd">, number>>;
  /**
   * No longer sold. Existing customers keep the plan, its limits and their Stripe price;
   * it's hidden from pricing and checkout, and the seed script doesn't create new prices for it.
   */
  legacy?: boolean;
  annualPrice?: number;
  /** One-time purchase price in cents (e.g. LIFETIME plan). */
  oneTimePrice?: number;
  /**
   * Per-email overage rates in USD, charged only on emails BEYOND the plan's monthlyEmailLimit.
   * Plans without this field are hard-capped (FREE) or don't bill overage (LIFETIME).
   */
  usageMetering?: OverageRates;
  /** The same overage rates in other currencies. */
  localUsageMetering?: Partial<Record<Exclude<Currency, "usd">, OverageRates>>;
  isLimited: boolean;
  order: number;
}

export interface StripeProduct {
  plan: PlanType;
  productId: string;
  prices: {
    monthly?: string;
    annual?: string;
    usage?: string;
    oneTime?: string;
  };
}

export interface StripeProductConfig {
  plan: PlanType;
  name: string;
  description: string;
  priceMonthly?: number;
  priceAnnual?: number;
  /**
   * One-time purchase price in cents (used for LIFETIME plan).
   * When set, creates a Stripe price with no `recurring` field.
   */
  priceOneTime?: number;
  meteringConfig?: {
    marketingRate: number;
    transactionalRate: number;
  };
}
