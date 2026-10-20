import { db } from "../db";

export const PRICE_KEYS = {
  hobby: { monthly: "stripe.price.hobby.monthly", marketingUsage: "stripe.price.hobby.marketing_usage", transactionalUsage: "stripe.price.hobby.transactional_usage" },
  lite: { monthly: "stripe.price.lite.monthly", marketingUsage: "stripe.price.lite.marketing_usage", transactionalUsage: "stripe.price.lite.transactional_usage" },
  basic: { monthly: "stripe.price.basic.monthly", marketingUsage: "stripe.price.basic.marketing_usage", transactionalUsage: "stripe.price.basic.transactional_usage" },
  scale: { monthly: "stripe.price.scale.monthly", marketingUsage: "stripe.price.scale.marketing_usage", transactionalUsage: "stripe.price.scale.transactional_usage" },
  lifetime: { oneTime: "stripe.price.lifetime.one_time" },
  addon: {
    domainMonthly: "stripe.price.addon.domain_monthly",
    memberMonthly: "stripe.price.addon.member_monthly",
  },
} as const;

let _cache: Map<string, string> | null = null;

export async function getStripeConfig(): Promise<Map<string, string>> {
  if (_cache) return _cache;

  const rows = await db.appSetting.findMany({
    where: { key: { startsWith: "stripe." } },
  });

  _cache = new Map(rows.map((r) => [r.key, r.value]));
  return _cache;
}

export function invalidateStripeConfigCache(): void {
  _cache = null;
}

export async function getStripeValue(key: string): Promise<string | undefined> {
  const config = await getStripeConfig();
  return config.get(key);
}

export async function getPlanPriceIds(plan: "HOBBY" | "LITE" | "BASIC" | "SCALE" | "LIFETIME"): Promise<{
  monthly?: string;
  marketingUsage?: string;
  transactionalUsage?: string;
  oneTime?: string;
}> {
  const config = await getStripeConfig();
  const get = (k: string) => config.get(k);

  switch (plan) {
    case "HOBBY":
      return {
        monthly: get(PRICE_KEYS.hobby.monthly),
        marketingUsage: get(PRICE_KEYS.hobby.marketingUsage),
        transactionalUsage: get(PRICE_KEYS.hobby.transactionalUsage),
      };
    case "LITE":
      return {
        monthly: get(PRICE_KEYS.lite.monthly),
        marketingUsage: get(PRICE_KEYS.lite.marketingUsage),
        transactionalUsage: get(PRICE_KEYS.lite.transactionalUsage),
      };
    case "BASIC":
      return {
        monthly: get(PRICE_KEYS.basic.monthly),
        marketingUsage: get(PRICE_KEYS.basic.marketingUsage),
        transactionalUsage: get(PRICE_KEYS.basic.transactionalUsage),
      };
    case "SCALE":
      return {
        monthly: get(PRICE_KEYS.scale.monthly),
        marketingUsage: get(PRICE_KEYS.scale.marketingUsage),
        transactionalUsage: get(PRICE_KEYS.scale.transactionalUsage),
      };
    case "LIFETIME":
      return {
        oneTime: get(PRICE_KEYS.lifetime.oneTime),
      };
  }
}

export async function buildPriceIdToPlanMap(): Promise<Map<string, string>> {
  const config = await getStripeConfig();
  const map = new Map<string, string>();

  const planEntries: Array<[string, string]> = [
    [PRICE_KEYS.hobby.monthly, "HOBBY"],
    [PRICE_KEYS.lite.monthly, "LITE"],
    [PRICE_KEYS.basic.monthly, "BASIC"],
    [PRICE_KEYS.scale.monthly, "SCALE"],
    [PRICE_KEYS.lifetime.oneTime, "LIFETIME"],
  ];

  for (const [key, plan] of planEntries) {
    const priceId = config.get(key);
    if (priceId) map.set(priceId, plan);
  }

  return map;
}

export async function getAddonPriceIds(): Promise<Set<string>> {
  const config = await getStripeConfig();
  const ids = new Set<string>();
  const domainPriceId = config.get(PRICE_KEYS.addon.domainMonthly);
  const memberPriceId = config.get(PRICE_KEYS.addon.memberMonthly);
  if (domainPriceId) ids.add(domainPriceId);
  if (memberPriceId) ids.add(memberPriceId);
  return ids;
}

export async function getAddonPriceIdsByType(): Promise<{
  domainMonthly: string | undefined;
  memberMonthly: string | undefined;
}> {
  const config = await getStripeConfig();
  return {
    domainMonthly: config.get(PRICE_KEYS.addon.domainMonthly),
    memberMonthly: config.get(PRICE_KEYS.addon.memberMonthly),
  };
}

export async function getWebhookSecret(): Promise<string | undefined> {
  return getStripeValue("stripe.webhook.secret");
}
