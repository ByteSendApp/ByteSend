"use client";

import { useMemo, useState } from "react";
import { Button } from "@bytesend/ui/src/button";
import { Card } from "@bytesend/ui/src/card";
import Spinner from "@bytesend/ui/src/spinner";
import { CheckCircle2 } from "lucide-react";
import { PLANS } from "@bytesend/lib";
import { PLAN_PERKS } from "~/lib/constants/payments";
import { api } from "~/trpc/react";
import type { CheckoutPlan } from "~/components/payments/UpgradeButton";

type PaidPlan = CheckoutPlan;

type BillingPlanSelectorProps = {
    currentPlan: string;
    onManageClick: () => Promise<void>;
    isManaging: boolean;
};

const PAID_PLAN_OPTIONS: PaidPlan[] = ["HOBBY", "BASIC", "SCALE"];

function estimatePlanCost(plan: PaidPlan, marketing: number, transactional: number) {
    const planConfig = PLANS[plan];
    const baseMonthly = planConfig.monthlyPrice / 100;
    const included = planConfig.limits.monthlyEmailLimit;
    const rates = planConfig.usageMetering;

    const totalEmails = marketing + transactional;
    const overageTotal = Math.max(0, totalEmails - included);
    const marketingShare = totalEmails > 0 ? marketing / totalEmails : 0;
    const transactionalShare = totalEmails > 0 ? transactional / totalEmails : 0;

    const marketingOverage = overageTotal * marketingShare;
    const transactionalOverage = overageTotal * transactionalShare;
    const marketingOverageCost = rates ? marketingOverage * rates.marketing : 0;
    const transactionalOverageCost = rates
        ? transactionalOverage * rates.transactional
        : 0;

    return {
        plan,
        included,
        baseMonthly,
        overageTotal,
        total: baseMonthly + marketingOverageCost + transactionalOverageCost,
    };
}

export function BillingPlanSelector({
    currentPlan,
    onManageClick,
    isManaging,
}: BillingPlanSelectorProps) {
    const [marketing, setMarketing] = useState(25000);
    const [transactional, setTransactional] = useState(25000);

    const estimates = useMemo(() => {
        return PAID_PLAN_OPTIONS.map((plan) =>
            estimatePlanCost(plan, marketing, transactional),
        );
    }, [marketing, transactional]);

    const recommended = useMemo(() => {
        return estimates.reduce((best, current) =>
            current.total < best.total ? current : best,
        );
    }, [estimates]);

    const [selectedPlan, setSelectedPlan] = useState<PaidPlan>("BASIC");

    const selectedEstimate =
        estimates.find((estimate) => estimate.plan === selectedPlan) ?? recommended;

    const checkoutMutation = api.billing.createCustomCheckoutSession.useMutation();
    const canCheckoutDirectly = currentPlan === "FREE";

    const onCheckout = async () => {
        const url = await checkoutMutation.mutateAsync({
            plan: selectedPlan,
            marketingEmailLimit: marketing,
            transactionalEmailLimit: transactional,
            monthlyPriceCents: Math.round(selectedEstimate.total * 100),
        });
        if (url) {
            window.location.href = url;
        }
    };

    return (
        <Card className="rounded-xl border border-border/70 p-4 sm:p-6">
            <div className="flex flex-col gap-6">
                <div>
                    <h4 className="text-base font-semibold">Custom Plan Selector</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                        Set your expected monthly email mix, then choose the plan you want to start with in Stripe.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    <label className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Marketing emails / month</span>
                            <span className="tabular-nums text-muted-foreground">
                                {marketing.toLocaleString()}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={1000}
                            max={3000000}
                            step={500}
                            value={marketing}
                            onChange={(e) => setMarketing(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </label>

                    <label className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Transactional emails / month</span>
                            <span className="tabular-nums text-muted-foreground">
                                {transactional.toLocaleString()}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={1000}
                            max={3000000}
                            step={500}
                            value={transactional}
                            onChange={(e) => setTransactional(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                    </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {estimates.map((estimate) => {
                        const isSelected = selectedPlan === estimate.plan;
                        const isRecommended = recommended.plan === estimate.plan;
                        const planData = PLANS[estimate.plan];
                        return (
                            <button
                                key={estimate.plan}
                                type="button"
                                onClick={() => setSelectedPlan(estimate.plan)}
                                className={`rounded-lg border p-3 text-left transition-colors ${isSelected
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold">{planData.displayName}</span>
                                    {isRecommended ? (
                                        <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                            Recommended
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-2 text-xl font-semibold tabular-nums">
                                    ${estimate.total.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">monthly contract price</div>
                            </button>
                        );
                    })}
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <div className="text-sm font-semibold">
                                {PLANS[selectedEstimate.plan].displayName} selected
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Includes {marketing.toLocaleString()} marketing and {transactional.toLocaleString()} transactional emails/month.
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">Monthly contract price</div>
                            <div className="text-xl font-semibold tabular-nums text-primary">${selectedEstimate.total.toFixed(2)}</div>
                        </div>
                    </div>

                    <ul className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {(PLAN_PERKS[selectedEstimate.plan] ?? []).slice(0, 6).map((perk) => (
                            <li
                                key={perk}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green" />
                                {perk}
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4">
                        {canCheckoutDirectly ? (
                            <Button
                                onClick={onCheckout}
                                className="w-full sm:w-auto"
                                disabled={checkoutMutation.isPending}
                            >
                                {checkoutMutation.isPending ? (
                                    <Spinner className="w-4 h-4" />
                                ) : (
                                    `Checkout ${PLANS[selectedPlan].displayName}`
                                )}
                            </Button>
                        ) : (
                            <Button
                                onClick={onManageClick}
                                className="w-full sm:w-auto"
                                variant="outline"
                                disabled={isManaging}
                            >
                                {isManaging ? <Spinner className="w-4 h-4" /> : "Change in billing portal"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
