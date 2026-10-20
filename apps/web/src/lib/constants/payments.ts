import { PLANS, getAllPlans } from "@bytesend/lib";

function fmt(n: number): string {
  if (!isFinite(n) || n === -1) return "Unlimited";
  return n.toLocaleString();
}

function formatOverageRate(rate: number): string {
  if (!isFinite(rate) || rate <= 0) return "N/A";
  return `$${(rate * 1000).toFixed(2)}/1,000`;
}

function buildPerks(plan: (typeof PLANS)[keyof typeof PLANS]): string[] {
  const l = plan.limits;
  const perks: string[] = [];

  if (!isFinite(l.monthlyEmailLimit)) {
    perks.push("Unlimited emails: no overage charges");
  } else {
    const suffix = plan.plan === "FREE" ? " (hard cap)" : " included";
    perks.push(`${fmt(l.monthlyEmailLimit)} emails / month${suffix}`);

    if (!isFinite(l.dailyEmailLimit)) {
      perks.push("Unlimited daily sending");
    } else {
      const dailySuffix = plan.plan === "FREE" ? " (hard cap)" : "";
      perks.push(`${fmt(l.dailyEmailLimit)} emails / day${dailySuffix}`);
    }
  }

  if (!l.marketingEmailsIncluded) {
    perks.push("Marketing emails not available");
  } else if (plan.usageMetering) {
    perks.push(`Marketing ${formatOverageRate(plan.usageMetering.marketing)} (overage)`);
    if (plan.usageMetering.transactional !== plan.usageMetering.marketing) {
      perks.push(
        `Transactional ${formatOverageRate(plan.usageMetering.transactional)} (overage)`,
      );
    }
  } else {
    perks.push("Marketing & transactional included");
  }

  if (l.additionalDomainRateCents > 0) {
    perks.push(`Up to ${fmt(l.maxDomains)} domains + $${l.additionalDomainRateCents / 100}/extra`);
  } else {
    perks.push(`Up to ${fmt(l.maxDomains)} domains`);
  }

  if (!isFinite(l.maxTeamMembers)) {
    perks.push("Unlimited team members");
  } else {
    const memberAddonSuffix =
      l.extraMemberRateCents > 0
        ? ` + $${(l.extraMemberRateCents / 100).toFixed(2)}/extra member`
        : "";
    perks.push(`Up to ${l.maxTeamMembers} team members${memberAddonSuffix}`);
  }

  perks.push(l.prioritySupport ? "Priority support" : "Community support");

  if (l.advancedAnalytics) perks.push("Advanced analytics");

  return perks;
}

export const PLAN_PERKS: Record<string, string[]> = Object.fromEntries(
  getAllPlans().map((plan) => [plan.plan, buildPerks(plan)]),
);
