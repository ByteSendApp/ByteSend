import Stripe from "stripe";
import type { Plan } from "@prisma/client";
import { env } from "~/env";
import { db } from "../db";
import { sendSubscriptionConfirmationEmail } from "../mailer";
import { TeamService } from "../service/team-service";
import { logger } from "../logger/log";
import {
  getPlanPriceIds,
  getAddonPriceIds,
  getAddonPriceIdsByType,
  buildPriceIdToPlanMap,
  getStripeValue,
  PRICE_KEYS,
} from "./stripe-config";

/** Plans that can be bought. LITE and LIFETIME are legacy: kept for existing customers only. */
export type CheckoutPlan = Extract<Plan, "HOBBY" | "BASIC" | "SCALE">;
export type CustomBasePlan = Extract<Plan, "LITE" | "HOBBY" | "BASIC" | "SCALE">;

export type CustomPlanContract = {
  basePlan: CustomBasePlan;
  marketingEmailLimit: number;
  transactionalEmailLimit: number;
  monthlyPriceCents: number;
};

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

async function createCustomerForTeam(teamId: number) {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ metadata: { teamId } });

  await TeamService.updateTeam(teamId, {
    billingEmail: customer.email,
    stripeCustomerId: customer.id,
  });

  return customer;
}

async function ensureTeamCustomerId(teamId: number, existingCustomerId?: string | null) {
  const stripe = getStripe();
  let customerId = existingCustomerId;

  if (!customerId) {
    const customer = await createCustomerForTeam(teamId);
    customerId = customer.id;
    return customerId;
  }

  try {
    await stripe.customers.retrieve(customerId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      const customer = await createCustomerForTeam(teamId);
      customerId = customer.id;
    } else {
      throw err;
    }
  }

  return customerId;
}

/**
 * With STRIPE_AUTOMATIC_TAX on, Checkout collects a billing address, lets businesses add a VAT
 * or tax ID (so EU B2B sales are reverse-charged), and Stripe Tax adds the right VAT/sales tax.
 * Stripe Tax must be activated, with registrations added, in the Stripe dashboard first.
 */
function taxOptions(): Partial<Stripe.Checkout.SessionCreateParams> {
  if (!env.STRIPE_AUTOMATIC_TAX) return {};
  return {
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
  };
}

export async function createCheckoutSessionForTeam(
  teamId: number,
  plan: CheckoutPlan = "BASIC",
) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");
  if (team.isActive && team.plan !== "FREE") throw new Error("Team is already active");

  const stripe = getStripe();
  const customerId = await ensureTeamCustomerId(teamId, team.stripeCustomerId);

  const priceIds = await getPlanPriceIds(plan);

  if (!priceIds.monthly) {
    throw new Error(`Stripe not seeded: run \`pnpm stripe:seed\` to create ${plan} price IDs in DB`);
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      { price: priceIds.monthly, quantity: 1 },
      ...(priceIds.marketingUsage ? [{ price: priceIds.marketingUsage }] : []),
      ...(priceIds.transactionalUsage ? [{ price: priceIds.transactionalUsage }] : []),
    ],
    success_url: `${env.NEXTAUTH_URL}/payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXTAUTH_URL}/settings/billing`,
    metadata: { teamId: teamId.toString(), plan },
    client_reference_id: teamId.toString(),
    ...taxOptions(),
  });
}

export async function createCustomCheckoutSessionForTeam(
  teamId: number,
  contract: CustomPlanContract,
) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");
  if (team.isActive && team.plan !== "FREE") throw new Error("Team is already active");

  const customerId = await ensureTeamCustomerId(teamId, team.stripeCustomerId);
  const stripe = getStripe();

  const metadata = {
    teamId: teamId.toString(),
    customPlanEnabled: "true",
    plan: contract.basePlan,
    customMarketingEmailLimit: contract.marketingEmailLimit.toString(),
    customTransactionalEmailLimit: contract.transactionalEmailLimit.toString(),
    customMonthlyPriceCents: contract.monthlyPriceCents.toString(),
  };

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: contract.monthlyPriceCents,
          product_data: {
            name: `ByteSend Custom ${contract.basePlan}`,
            description: `${contract.marketingEmailLimit.toLocaleString()} marketing + ${contract.transactionalEmailLimit.toLocaleString()} transactional emails per month`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${env.NEXTAUTH_URL}/payments?success=true&custom=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXTAUTH_URL}/settings/billing`,
    metadata,
    subscription_data: {
      metadata,
    },
    client_reference_id: teamId.toString(),
    ...taxOptions(),
  });
}

export async function createAddonCheckoutSession(
  teamId: number,
  quantity: number = 1,
  addonType: "EXTRA_DOMAIN" | "EXTRA_MEMBER" = "EXTRA_DOMAIN",
) {
  const priceKey = addonType === "EXTRA_DOMAIN" ? PRICE_KEYS.addon.domainMonthly : PRICE_KEYS.addon.memberMonthly;
  const addonPriceId = await getStripeValue(priceKey);
  if (!addonPriceId) {
    throw new Error(`Stripe not seeded: run \`pnpm stripe:seed\` to create ${addonType.toLowerCase()} add-on price in DB`);
  }

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const stripe = getStripe();

  let customerId = team.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomerForTeam(teamId);
    customerId = customer.id;
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: addonPriceId, quantity }],
    success_url: `${env.NEXTAUTH_URL}/payments?success=true&addon=${addonType.toLowerCase()}&qty=${quantity}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXTAUTH_URL}/settings/billing`,
    metadata: {
      teamId: teamId.toString(),
      addonType: addonType,
      quantity: quantity.toString(),
    },
    client_reference_id: teamId.toString(),
    ...taxOptions(),
  });
}

const KNOWN_PLANS = new Set<string>(["FREE", "LITE", "HOBBY", "BASIC", "SCALE", "LIFETIME"]);

/**
 * Reads the plan the seed script stamps on every plan price (`metadata.plan`). Unlike matching
 * against the configured price IDs, this keeps working for subscribers on older prices after a
 * price change, so a re-seed never quietly downgrades them.
 */
export function planFromPriceMetadata(items: Array<{ price?: { metadata?: Record<string, string> | null } | null }>): Plan | null {
  for (const item of items) {
    const metadata = item.price?.metadata;
    if (!metadata?.plan || !KNOWN_PLANS.has(metadata.plan)) continue;
    if (metadata.type && metadata.type !== "monthly" && metadata.type !== "one-time") continue;
    return metadata.plan as Plan;
  }
  return null;
}

async function getPlanFromPriceIds(priceIds: string[]): Promise<Plan> {
  const map = await buildPriceIdToPlanMap();
  const priceSet = new Set(priceIds);
  for (const [priceId, plan] of map) {
    if (priceSet.has(priceId)) return plan as Plan;
  }
  return "FREE";
}

const OVERAGE_ITEMS = [
  { type: "marketing-usage", priceKey: "marketingUsage", meterKey: "stripe.meter.marketing" },
  { type: "transactional-usage", priceKey: "transactionalUsage", meterKey: "stripe.meter.transactional" },
] as const;

/**
 * The customer portal only swaps the monthly price on a plan change, which leaves the metered
 * overage items on the old plan's rates. Re-points them at the new plan's overage prices.
 * Subscriptions still on an older monthly price are grandfathered and left alone.
 */
export async function alignOverageItems(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  plan: Exclude<Plan, "FREE" | "LIFETIME">,
) {
  const target = await getPlanPriceIds(plan);
  if (!target.monthly || !subscription.items.data.some((item) => item.price?.id === target.monthly)) return;

  const meteredItems = subscription.items.data.filter((item) => item.price?.recurring?.usage_type === "metered");
  const changes: Stripe.SubscriptionUpdateParams.Item[] = [];
  const matched = new Set<string>();

  for (const { type, priceKey, meterKey } of OVERAGE_ITEMS) {
    const targetPriceId = target[priceKey];
    const meterId = await getStripeValue(meterKey);
    if (!targetPriceId) continue;

    const items = meteredItems.filter(
      (item) => item.price.metadata?.type === type || (meterId && item.price.recurring?.meter === meterId),
    );
    items.forEach((item) => matched.add(item.id));
    if (items.length === 1 && items[0]!.price.id === targetPriceId) continue;

    for (const item of items) changes.push({ id: item.id, deleted: true });
    changes.push({ price: targetPriceId });
  }

  // An unrecognised metered item could share a meter with the new price and double-bill usage.
  if (meteredItems.some((item) => !matched.has(item.id))) {
    logger.warn({ subscriptionId: subscription.id, plan }, "[Billing]: unrecognised metered item, overage prices not aligned");
    return;
  }
  if (changes.length === 0) return;

  try {
    await stripe.subscriptions.update(subscription.id, { items: changes, proration_behavior: "none" });
    logger.info({ subscriptionId: subscription.id, plan }, "[Billing]: overage prices aligned with plan");
  } catch (error) {
    logger.error({ err: error, subscriptionId: subscription.id, plan }, "[Billing]: failed to align overage prices");
  }
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseCustomBasePlan(value: string | undefined): CustomBasePlan | null {
  if (value === "HOBBY" || value === "LITE" || value === "BASIC" || value === "SCALE") {
    return value;
  }
  return null;
}

export async function getManageSessionUrl(teamId: number) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");
  if (!team.stripeCustomerId) throw new Error("Team has no Stripe customer ID");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${env.NEXTAUTH_URL}`,
  });
  return session.url;
}

export async function syncStripeData(customerId: string) {
  const stripe = getStripe();

  const team = await db.team.findUnique({ where: { stripeCustomerId: customerId } });
  if (!team) return;

  const wasPaid = team.isActive && team.plan !== "FREE";

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 20,
    status: "all",
    expand: ["data.default_payment_method"],
  });

  const addonPriceIds = await getAddonPriceIds();
  const addonPricesByType = await getAddonPriceIdsByType();

  const planSubscription =
    subscriptions.data.find((sub) =>
      sub.items.data.some((item) => item.price?.id && !addonPriceIds.has(item.price.id)),
    ) ?? null;

  let extraDomainSlots = 0;
  let extraMemberSlots = 0;
  for (const sub of subscriptions.data) {
    if (sub.status === "active") {
      for (const item of sub.items.data) {
        if (item.price?.id === addonPricesByType.domainMonthly) {
          extraDomainSlots += item.quantity ?? 1;
        } else if (item.price?.id === addonPricesByType.memberMonthly) {
          extraMemberSlots += item.quantity ?? 1;
        }
      }
    }
  }

  await db.team.update({
    where: { id: team.id },
    data: { extraDomainSlots, extraMemberSlots }
  });
  await TeamService.invalidateTeamCache(team.id);

  if (!planSubscription?.items.data[0]) return;

  const subscription = planSubscription;
  const priceIds = subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id));

  const customPlanEnabled = subscription.metadata?.customPlanEnabled === "true";
  const customBasePlan = parseCustomBasePlan(subscription.metadata?.plan);
  const customMarketingEmailLimit = parsePositiveInt(subscription.metadata?.customMarketingEmailLimit);
  const customTransactionalEmailLimit = parsePositiveInt(subscription.metadata?.customTransactionalEmailLimit);
  const customMonthlyPriceCents = parsePositiveInt(subscription.metadata?.customMonthlyPriceCents);

  const nextPlan = customPlanEnabled
    ? (customBasePlan ?? team.plan)
    : (planFromPriceMetadata(subscription.items.data) ?? (await getPlanFromPriceIds(priceIds)));
  const isNowPaid = subscription.status === "active" && nextPlan !== "FREE";

  if (
    !customPlanEnabled &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    nextPlan !== "FREE" &&
    nextPlan !== "LIFETIME"
  ) {
    await alignOverageItems(stripe, subscription, nextPlan);
  }
  const shouldSendSubscriptionConfirmation = !wasPaid && isNowPaid;

  const periodEnd = subscription.items.data[0]?.current_period_end;
  const periodStart = subscription.items.data[0]?.current_period_start;

  await db.subscription.upsert({
    where: { id: subscription.id },
    update: {
      status: subscription.status,
      priceId: subscription.items.data[0]?.price?.id ?? "",
      priceIds,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      paymentMethod: JSON.stringify(subscription.default_payment_method),
      teamId: team.id,
    },
    create: {
      id: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0]?.price?.id ?? "",
      priceIds,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      paymentMethod: JSON.stringify(subscription.default_payment_method),
      teamId: team.id,
    },
  });

  await TeamService.updateTeam(team.id, {
    plan: subscription.status === "canceled" ? "FREE" : nextPlan,
    isActive: subscription.status === "active",
    customPlanEnabled:
      subscription.status === "active" &&
      customPlanEnabled &&
      Boolean(customBasePlan && customMarketingEmailLimit && customTransactionalEmailLimit && customMonthlyPriceCents),
    customMarketingEmailLimit:
      subscription.status === "active" && customPlanEnabled
        ? customMarketingEmailLimit
        : null,
    customTransactionalEmailLimit:
      subscription.status === "active" && customPlanEnabled
        ? customTransactionalEmailLimit
        : null,
    customMonthlyPriceCents:
      subscription.status === "active" && customPlanEnabled
        ? customMonthlyPriceCents
        : null,
  });

  logger.info(
    { teamId: team.id, plan: nextPlan, status: subscription.status },
    "[Billing]: syncStripeData complete"
  );

  if (shouldSendSubscriptionConfirmation) {
    try {
      const teamUsers = await TeamService.getTeamUsers(team.id);
      await Promise.all(
        teamUsers
          .map((tu) => tu.user?.email)
          .filter((email): email is string => Boolean(email))
          .map((email) => sendSubscriptionConfirmationEmail(email)),
      );
    } catch (err) {
      logger.error({ err, teamId: team.id }, "[Billing]: Failed sending subscription confirmation email");
    }
  }
}

export async function syncLifetimePayment(customerId: string) {
  const team = await db.team.findUnique({ where: { stripeCustomerId: customerId } });

  if (!team) {
    logger.warn({ customerId }, "[Billing]: LIFETIME payment: team not found for customer");
    return;
  }

  if (team.plan === "LIFETIME") return;

  await TeamService.updateTeam(team.id, {
    plan: "LIFETIME",
    isActive: true,
    customPlanEnabled: false,
    customMarketingEmailLimit: null,
    customTransactionalEmailLimit: null,
    customMonthlyPriceCents: null,
  });

  try {
    const teamUsers = await TeamService.getTeamUsers(team.id);
    await Promise.all(
      teamUsers
        .map((tu) => tu.user?.email)
        .filter((email): email is string => Boolean(email))
        .map((email) => sendSubscriptionConfirmationEmail(email)),
    );
  } catch (err) {
    logger.error({ err, teamId: team.id }, "[Billing]: Failed sending LIFETIME confirmation email");
  }
}

