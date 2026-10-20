"use client";

import React from "react";
import { PLANS, SOLD_PAID_PLANS, type SoldPaidPlan } from "@bytesend/lib";

type SliderProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 500,
  suffix = "",
}: SliderProps) {
  const id = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  React.useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
      window.removeEventListener("pointerup", stop);
    };
  }, [dragging]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="w-full sm:w-56 md:w-72 shrink-0">
        <label htmlFor={id} className="text-sm font-medium block">
          {label}
        </label>
        <div className="mt-1 text-xs sm:text-sm text-muted-foreground tabular-nums truncate">
          {value.toLocaleString()} {suffix}
        </div>
      </div>
      <div className="relative flex-1">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => setDragging(true)}
          onTouchStart={() => setDragging(true)}
          onPointerDown={() => setDragging(true)}
          className="w-full accent-primary"
          aria-label={label}
          aria-valuetext={`${value.toLocaleString()} ${suffix}`}
        />
        {dragging && (
          <div
            className="pointer-events-none absolute -top-9 left-0 -translate-x-1/2"
            style={{ left: `${percent}%` }}
          >
            <div className="rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background tabular-nums shadow whitespace-nowrap">
              {value.toLocaleString()} {suffix}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PricingCalculator() {
  const [selectedPlan, setSelectedPlan] = React.useState<SoldPaidPlan>("BASIC");
  const [marketing, setMarketing] = React.useState<number>(25000);
  const [transactional, setTransactional] = React.useState<number>(25000);

  const plan = PLANS[selectedPlan];
  const baseMonthly = plan.monthlyPrice / 100;
  const included = plan.limits.monthlyEmailLimit;
  const rates = plan.usageMetering;

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
  const estimatedTotal = baseMonthly + marketingOverageCost + transactionalOverageCost;

  const formatRatePerThousand = (value: number) =>
    `$${(value * 1000).toFixed(2)}/1,000`;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-5 pb-8 sm:p-6">
        <div className="mx-auto mb-5 grid w-full max-w-md grid-cols-3 gap-1 rounded-md border border-border bg-muted/50 p-0.5">
          {SOLD_PAID_PLANS.map((planKey) => {
            const planLabel = PLANS[planKey].displayName;
            const isSelected = selectedPlan === planKey;
            return (
              <button
                key={planKey}
                type="button"
                onClick={() => setSelectedPlan(planKey)}
                className={`rounded-[5px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={isSelected}
              >
                {planLabel}
              </button>
            );
          })}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground sm:p-4 sm:text-[13px]">
          <span className="font-medium text-foreground">{plan.displayName}</span>{" "}
          includes {included.toLocaleString()} emails/month. Overage estimate uses {" "}
          {rates
            ? `${formatRatePerThousand(rates.marketing)} marketing and ${formatRatePerThousand(rates.transactional)} transactional`
            : "configured rates"}
          .
        </div>

        <div className="mt-5 flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <div className="text-sm uppercase tracking-wider text-primary">
                Pricing Calculator
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Estimate monthly cost for marketing and transactional email volume.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Slider
                label="Marketing emails / month"
                value={marketing}
                onChange={setMarketing}
                min={0}
                max={3000000}
                step={500}
                suffix="emails"
              />
              <Slider
                label="Transactional emails / month"
                value={transactional}
                onChange={setTransactional}
                min={0}
                max={3000000}
                step={500}
                suffix="emails"
              />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-4 items-center">
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Plan base</div>
                <div className="text-lg font-medium">${baseMonthly.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {plan.displayName} monthly
                </div>
              </div>
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Marketing overage</div>
                <div className="text-lg font-medium">${marketingOverageCost.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(marketingOverage).toLocaleString()} estimated overage emails
                </div>
              </div>
              <div className="rounded-md border border-border p-4">
                <div className="text-xs text-muted-foreground">Transactional overage</div>
                <div className="text-lg font-medium">${transactionalOverageCost.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(transactionalOverage).toLocaleString()} estimated overage emails
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/[0.06] p-4">
                <div className="text-xs text-muted-foreground">Estimated Total</div>
                <div className="text-3xl text-primary font-semibold">${estimatedTotal.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {totalEmails <= included
                    ? "Within included monthly volume"
                    : `${overageTotal.toLocaleString()} overage emails across both streams`}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Estimate only. Actual billed overage is metered monthly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingCalculator;
