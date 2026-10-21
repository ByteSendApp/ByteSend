"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@bytesend/ui/src/card";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Button } from "@bytesend/ui/src/button";
import Spinner from "@bytesend/ui/src/spinner";
import { format } from "date-fns";
import {
  getCost,
  PLAN_CREDIT_UNITS,
  UNIT_PRICE,
  USAGE_UNIT_PRICE,
} from "~/lib/usage";
import { useTeam } from "~/providers/team-context";
import { EmailUsageType } from "@prisma/client";
import { PlanDetails } from "~/components/payments/PlanDetails";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { Progress } from "@bytesend/ui/src/progress";
import { PLANS } from "@bytesend/lib";
import { LimitReason } from "~/lib/constants/plans";

const UNLIMITED_PLANS = new Set(["BASIC", "LIFETIME"]);

function ChoosePlanButton() {
  const { action: { openModal } } = useUpgradeModalStore();
  return (
    <Button className="w-full" onClick={() => openModal()}>
      Choose Plan
    </Button>
  );
}

const FREE_PLAN_LIMIT = PLANS.FREE.limits.monthlyEmailLimit;
const FREE_PLAN_DAILY_LIMIT = PLANS.FREE.limits.dailyEmailLimit;

function getUsageByType(
  usage: { type: EmailUsageType; sent: number }[],
  type: EmailUsageType,
): number {
  return usage.find((u) => u.type === type)?.sent ?? 0;
}

function getEffectiveEmailLimits(
  plan: "FREE" | "BASIC" | "HOBBY" | "LITE" | "SCALE" | "LIFETIME",
  customContract?: {
    customPlanEnabled: boolean;
    customMarketingEmailLimit: number | null;
    customTransactionalEmailLimit: number | null;
  } | null,
) {
  const hasCustom = Boolean(
    customContract?.customPlanEnabled &&
    customContract.customMarketingEmailLimit &&
    customContract.customTransactionalEmailLimit,
  );

  if (hasCustom) {
    const marketing = customContract?.customMarketingEmailLimit ?? 0;
    const transactional = customContract?.customTransactionalEmailLimit ?? 0;
    return {
      monthly: marketing + transactional,
      daily: -1,
      marketing,
      transactional,
      isCustom: true,
    };
  }

  const planLimits = PLANS[plan].limits;
  return {
    monthly: planLimits.monthlyEmailLimit,
    daily:
      Number.isFinite(planLimits.dailyEmailLimit) && planLimits.dailyEmailLimit > 0
        ? planLimits.dailyEmailLimit
        : -1,
    marketing: null,
    transactional: null,
    isCustom: false,
  };
}

function pct(current: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min((current / limit) * 100, 100);
}

/* ────────── Free-tier usage ────────── */

function FreePlanUsage({
  usage,
  dayUsage,
}: {
  usage: { type: EmailUsageType; sent: number }[];
  dayUsage: { type: EmailUsageType; sent: number }[];
}) {
  const totalSent = usage?.reduce((acc, item) => acc + item.sent, 0) || 0;
  const monthlyPct = Math.min((totalSent / FREE_PLAN_LIMIT) * 100, 100);
  const dailyUsage = dayUsage?.reduce((acc, item) => acc + item.sent, 0) || 0;
  const dailyPct = Math.min((dailyUsage / FREE_PLAN_DAILY_LIMIT) * 100, 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Monthly gauge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Monthly limit</span>
            <span className="text-sm font-mono text-muted-foreground">
              {totalSent.toLocaleString()}/{FREE_PLAN_LIMIT.toLocaleString()}
            </span>
          </div>
          <Progress value={monthlyPct} className="h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {(FREE_PLAN_LIMIT - totalSent).toLocaleString()} emails remaining
          </p>
        </CardContent>
      </Card>

      {/* Daily gauge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Daily limit</span>
            <span className="text-sm font-mono text-muted-foreground">
              {dailyUsage.toLocaleString()}/{FREE_PLAN_DAILY_LIMIT.toLocaleString()}
            </span>
          </div>
          <Progress value={dailyPct} className="h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            Resets at midnight UTC
          </p>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card className="sm:col-span-2 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usage?.map((item) => (
            <div
              key={item.type}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className="font-medium capitalize">
                  {item.type.toLowerCase()}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.type === "TRANSACTIONAL"
                    ? "API & SMTP"
                    : "Campaign editor"}
                </span>
              </div>
              <span className="font-mono">
                {item.sent.toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EmailLimitsBreakdown({
  usage,
  dayUsage,
  plan,
  customContract,
}: {
  usage: { type: EmailUsageType; sent: number }[];
  dayUsage: { type: EmailUsageType; sent: number }[];
  plan: "FREE" | "BASIC" | "HOBBY" | "LITE" | "SCALE" | "LIFETIME";
  customContract?: {
    customPlanEnabled: boolean;
    customMarketingEmailLimit: number | null;
    customTransactionalEmailLimit: number | null;
  } | null;
}) {
  const limits = getEffectiveEmailLimits(plan, customContract);

  const monthlyTotalSent = usage.reduce((acc, item) => acc + item.sent, 0);
  const dailyTotalSent = dayUsage.reduce((acc, item) => acc + item.sent, 0);
  const monthlyMarketingSent = getUsageByType(usage, "MARKETING");
  const monthlyTransactionalSent = getUsageByType(usage, "TRANSACTIONAL");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Email limits breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ResourceLimitRow
          label="Emails this period"
          currentCount={monthlyTotalSent}
          limit={limits.monthly}
        />

        <ResourceLimitRow
          label="Emails today"
          currentCount={dailyTotalSent}
          limit={limits.daily}
        />

        {limits.marketing !== null ? (
          <ResourceLimitRow
            label="Marketing emails"
            currentCount={monthlyMarketingSent}
            limit={limits.marketing}
          />
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">Marketing emails</span>
              <span className="text-sm font-mono text-muted-foreground">
                {monthlyMarketingSent.toLocaleString()} / shared monthly pool
              </span>
            </div>
            <Progress value={pct(monthlyMarketingSent, limits.monthly)} className="h-1.5" />
          </div>
        )}

        {limits.transactional !== null ? (
          <ResourceLimitRow
            label="Transactional emails"
            currentCount={monthlyTransactionalSent}
            limit={limits.transactional}
          />
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">Transactional emails</span>
              <span className="text-sm font-mono text-muted-foreground">
                {monthlyTransactionalSent.toLocaleString()} / shared monthly pool
              </span>
            </div>
            <Progress value={pct(monthlyTransactionalSent, limits.monthly)} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────── Paid-tier usage ────────── */

function PaidPlanUsage({
  usage,
}: {
  usage: { type: EmailUsageType; sent: number }[];
}) {
  const { currentTeam } = useTeam();
  if (currentTeam?.plan === "FREE") return null;

  const plan = currentTeam?.plan ?? "FREE";
  const isUnlimited = UNLIMITED_PLANS.has(plan);
  const totalCost =
    usage?.reduce((acc, item) => acc + getCost(item.sent, item.type), 0) || 0;
  const planCreditCost = isUnlimited
    ? 0
    : (PLAN_CREDIT_UNITS[plan as keyof typeof PLAN_CREDIT_UNITS] ?? 0) * UNIT_PRICE;
  const creditRemaining = isUnlimited ? null : Math.max(planCreditCost - totalCost, 0);
  const amountDue = isUnlimited ? 0 : Math.max(totalCost - planCreditCost, 0);
  const creditPct =
    !isUnlimited && planCreditCost > 0
      ? Math.min(100, 100 - (totalCost / planCreditCost) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Amount due */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Amount due
          </p>
          <p className="mt-2 text-3xl font-bold font-mono">
            {isUnlimited ? "$0.00" : `$${amountDue.toFixed(2)}`}
          </p>
          {isUnlimited && (
            <p className="mt-1 text-xs text-muted-foreground">Included in plan</p>
          )}
        </CardContent>
      </Card>

      {/* Credit remaining */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Credit remaining
          </p>
          <p className="mt-2 text-3xl font-bold font-mono">
            {isUnlimited ? "∞" : `$${(creditRemaining ?? 0).toFixed(2)}`}
          </p>
          {!isUnlimited && <Progress value={creditPct} className="mt-3 h-1.5" />}
        </CardContent>
      </Card>

      {/* Total emails */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Emails sent
          </p>
          <p className="mt-2 text-3xl font-bold font-mono">
            {usage?.reduce((a, i) => a + i.sent, 0).toLocaleString() || "0"}
          </p>
        </CardContent>
      </Card>

      {/* Detailed breakdown */}
      <Card className="sm:col-span-3 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Cost breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {usage?.map((item) => (
              <div
                key={item.type}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm font-medium capitalize">
                    {item.type.toLowerCase()}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.sent.toLocaleString()} × ${USAGE_UNIT_PRICE[item.type]}
                  </span>
                </div>
                <span className="text-sm font-mono font-medium">
                  ${getCost(item.sent, item.type).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────── Resource limits ────────── */

function ResourceLimitRow({
  label,
  currentCount,
  limit,
}: {
  label: string;
  currentCount: number;
  limit: number;
}) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((currentCount / limit) * 100, 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-mono text-muted-foreground">
          {currentCount.toLocaleString()}{" "}
          {unlimited ? "/ ∞" : `/ ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={pct}
          className={`h-1.5 ${nearLimit ? "[&>div]:bg-amber-500" : ""}`}
        />
      )}
      {unlimited && (
        <p className="text-xs text-muted-foreground">No limit on this plan</p>
      )}
    </div>
  );
}

function ResourceLimits() {
  const { data: domainLimit, isLoading: dl } = api.limits.get.useQuery({ type: LimitReason.DOMAIN });
  const { data: contactBooksLimit, isLoading: cbl } = api.limits.get.useQuery({ type: LimitReason.CONTACT_BOOK });
  const { data: contactsLimit, isLoading: cl } = api.limits.get.useQuery({ type: LimitReason.CONTACTS });
  const { data: campaignLimit, isLoading: cal } = api.limits.get.useQuery({ type: LimitReason.CAMPAIGN });
  const { data: memberLimit, isLoading: ml } = api.limits.get.useQuery({ type: LimitReason.TEAM_MEMBER });
  const { data: webhookLimit, isLoading: wl } = api.limits.get.useQuery({ type: LimitReason.WEBHOOK });

  const isLoading = dl || cbl || cl || cal || ml || wl;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="w-5 h-5" innerSvgClass="stroke-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Resource limits breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {domainLimit && (
          <ResourceLimitRow
            label="Domains"
            currentCount={domainLimit.currentCount ?? 0}
            limit={domainLimit.limit}
          />
        )}
        {contactBooksLimit && (
          <ResourceLimitRow
            label="Contact books"
            currentCount={contactBooksLimit.currentCount ?? 0}
            limit={contactBooksLimit.limit}
          />
        )}
        {contactsLimit && (
          <ResourceLimitRow
            label="Contacts"
            currentCount={contactsLimit.currentCount ?? 0}
            limit={contactsLimit.limit}
          />
        )}
        {campaignLimit && (
          <ResourceLimitRow
            label="Campaigns"
            currentCount={campaignLimit.currentCount ?? 0}
            limit={campaignLimit.limit}
          />
        )}
        {memberLimit && (
          <ResourceLimitRow
            label="Team members"
            currentCount={memberLimit.currentCount ?? 0}
            limit={memberLimit.limit}
          />
        )}
        {webhookLimit && (
          <ResourceLimitRow
            label="Webhooks"
            currentCount={webhookLimit.currentCount ?? 0}
            limit={webhookLimit.limit}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ────────── Main page ────────── */

export default function UsagePage() {
  const { data: usage, isLoading } = api.billing.getThisMonthUsage.useQuery();
  const { currentTeam } = useTeam();
  const { data: subscription } = api.billing.getSubscriptionDetails.useQuery();
  const { data: customContract } = api.billing.getCustomPlanContract.useQuery();

  const today = new Date();
  const billingPeriod =
    subscription?.currentPeriodStart && subscription?.currentPeriodEnd
      ? `${format(new Date(subscription.currentPeriodStart), "MMM dd")} – ${format(new Date(subscription.currentPeriodEnd), "MMM dd")}`
      : `${format(new Date(today.getFullYear(), today.getMonth(), 1), "MMM dd")} – ${format(new Date(today.getFullYear(), today.getMonth() + 1, 1), "MMM dd")}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Usage" description={`Emails sent and resources used this billing period: ${billingPeriod}.`} />
      <div className="space-y-4">

        {currentTeam?.plan ? (
          <EmailLimitsBreakdown
            usage={usage?.month ?? []}
            dayUsage={usage?.day ?? []}
            plan={currentTeam.plan}
            customContract={customContract}
          />
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-6 h-6" innerSvgClass="stroke-primary" />
          </div>
        ) : usage?.month.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No usage data available
            </CardContent>
          </Card>
        ) : currentTeam?.plan === "FREE" ? (
          <FreePlanUsage usage={usage?.month ?? []} dayUsage={usage?.day ?? []} />
        ) : (
          <PaidPlanUsage usage={usage?.month ?? []} />
        )}
      </div>

      {/* Resource limits */}
      <ResourceLimits />

      {/* Current plan section */}
      {currentTeam?.plan && (
        <Card>
          <CardContent className="pt-6">
            <PlanDetails />
            {currentTeam.plan === "FREE" && (
              <div className="mt-6">
                <ChoosePlanButton />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
