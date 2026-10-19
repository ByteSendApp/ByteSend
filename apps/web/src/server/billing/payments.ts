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

export type CheckoutPlan = Extract<Plan, "LITE" | "HOBBY" | "BASIC" | "LIFETIME">;
export type CustomBasePlan = Extract<Plan, "LITE" | "HOBBY" | "BASIC">;

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

  if (plan === "LIFETIME") {
    if (!priceIds.oneTime) {
      throw new Error("Stripe not seeded: run `pnpm stripe:seed` to create price IDs in DB");
    }
    return stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceIds.oneTime, quantity: 1 }],
      success_url: `${env.NEXTAUTH_URL}/payments?success=true&plan=LIFETIME&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXTAUTH_URL}/settings/billing`,
      metadata: { teamId: teamId.toString(), plan },
      client_reference_id: teamId.toString(),
    });
  }

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
          currency: "cad",
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
  });
}

async function getPlanFromPriceIds(priceIds: string[]): Promise<Plan> {
  const map = await buildPriceIdToPlanMap();
  const priceSet = new Set(priceIds);
  for (const [priceId, plan] of map) {
    if (priceSet.has(priceId)) return plan as Plan;
  }
  return "FREE";
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseCustomBasePlan(value: string | undefined): CustomBasePlan | null {
  if (value === "HOBBY" || value === "LITE" || value === "BASIC") {
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
    : await getPlanFromPriceIds(priceIds);
  const isNowPaid = subscription.status === "active" && nextPlan !== "FREE";
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
    logger.warn({ customerId }, "[Billing]: LIFETIME payment — team not found for customer");
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

