import { EmailUsageType, Plan, Subscription } from "@prisma/client";
import { PLANS, PlanType } from "@bytesend/lib";

export function getUsageRate(
  plan: PlanType,
  type: EmailUsageType
): number {
  const planData = PLANS[plan];
  if (!planData.usageMetering) return 0;
  return type === EmailUsageType.MARKETING
    ? planData.usageMetering.marketing
    : planData.usageMetering.transactional;
}

export const USAGE_UNIT_PRICE: Record<EmailUsageType, number> = {
  [EmailUsageType.MARKETING]: PLANS.LITE.usageMetering!.marketing,
  [EmailUsageType.TRANSACTIONAL]: PLANS.LITE.usageMetering!.transactional,
};

export const UNIT_PRICE = PLANS.LITE.usageMetering!.marketing;

export const TRANSACTIONAL_UNIT_CONVERSION =
  UNIT_PRICE / USAGE_UNIT_PRICE[EmailUsageType.TRANSACTIONAL];

export const PLAN_CREDIT_UNITS = {
  [Plan.BASIC]: 5_000,
};

export function getUsageTimestamp() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return Math.floor(yesterday.getTime() / 1000);
}

export function getUsageDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isoString = yesterday.toISOString();
  return isoString.split("T")[0] as string;
}

export function getUsageUnits(
  marketingUsage: number,
  transactionUsage: number,
) {
  return (
    marketingUsage +
    Math.floor(transactionUsage / TRANSACTIONAL_UNIT_CONVERSION)
  );
}

export function getCost(usage: number, type: EmailUsageType) {
  const calculatedUsage =
    type === EmailUsageType.MARKETING
      ? usage
      : Math.floor(usage / TRANSACTIONAL_UNIT_CONVERSION);

  return calculatedUsage * UNIT_PRICE;
}
