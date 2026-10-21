"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, type Currency, type PlanType } from "@bytesend/lib";
import { Button } from "@bytesend/ui/src/button";
import { cn } from "@bytesend/ui/lib/utils";
import { PricingCalculator } from "~/components/marketing/PricingCalculator";
import { Reveal } from "./Reveal";
import { Section, SectionHeader } from "./Section";

const CARD_PLANS: PlanType[] = ["FREE", "HOBBY", "BASIC", "SCALE"];
const FEATURED: PlanType = "BASIC";
const SYMBOL: Record<Currency, string> = { usd: "$", gbp: "£", eur: "€" };
const number = new Intl.NumberFormat("en-US");

function monthlyPrice(plan: PlanType, currency: Currency) {
  const tier = PLANS[plan];
  const cents = currency === "usd" ? tier.monthlyPrice : (tier.localMonthlyPrice?.[currency] ?? tier.monthlyPrice);
  return cents / 100;
}

function perThousand(plan: PlanType, currency: Currency) {
  const tier = PLANS[plan];
  const rates = currency === "usd" ? tier.usageMetering : (tier.localUsageMetering?.[currency] ?? tier.usageMetering);
  if (!rates) return null;
  const fmt = (v: number) => `${SYMBOL[currency]}${(v * 1000).toFixed(2)}`;
  return `${fmt(rates.transactional)}–${fmt(rates.marketing)}`;
}

function highlights(plan: PlanType) {
  const l = PLANS[plan].limits;
  const items = [
    `${number.format(l.monthlyEmailLimit)} emails a month`,
    Number.isFinite(l.dailyEmailLimit) ? `Up to ${number.format(l.dailyEmailLimit)} a day` : "No daily cap",
    `${number.format(l.inboundEmailsPerMonth)} received emails a month`,
    `${l.maxDomains} domains · ${l.maxTeamMembers} team members`,
    `${number.format(l.contactsLimit)} marketing contacts`,
  ];
  if (l.prioritySupport) items.push("Priority support");
  if (l.advancedAnalytics) items.push("Open and click analytics");
  return items;
}

export function Pricing() {
  const [currency, setCurrency] = React.useState<Currency>("usd");

  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow="Pricing"
        title="Simple pricing that grows with you"
        description="Start free. Paid plans include a monthly allowance, and extra emails are billed per thousand, so you never hit a wall."
      />

      <div className="mb-6 flex justify-center">
        <div role="radiogroup" aria-label="Currency" className="inline-flex rounded-md border border-border bg-muted/50 p-0.5 text-[13px]">
          {(["usd", "gbp", "eur"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={currency === option}
              onClick={() => setCurrency(option)}
              className={cn(
                "rounded-[5px] px-3 py-1 font-medium uppercase transition-colors",
                currency === option ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SYMBOL[option]} {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARD_PLANS.map((plan, index) => {
          const tier = PLANS[plan];
          const price = monthlyPrice(plan, currency);
          const overage = perThousand(plan, currency);
          const featured = plan === FEATURED;
          return (
            <Reveal
              key={plan}
              delay={index * 60}
              className={cn(
                "relative flex flex-col rounded-lg border bg-card p-5",
                featured ? "border-primary/50 shadow-[0_20px_60px_-30px_rgba(0,87,255,0.6)]" : "border-border",
              )}
            >
              {featured ? (
                <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-[15px] font-semibold text-foreground">{tier.displayName}</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{tier.description}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {price === 0 ? "Free" : `${SYMBOL[currency]}${price % 1 === 0 ? price : price.toFixed(2)}`}
                </span>
                {price > 0 ? <span className="text-sm text-muted-foreground">/ month</span> : null}
              </p>
              <p className="mt-1 h-4 text-xs text-muted-foreground">{overage ? `then ${overage} per 1,000 extra` : "Hard limit, no overage"}</p>

              <Button asChild className="mt-5 h-9 w-full" variant={featured ? "default" : "outline"}>
                <Link href="/signup">{price === 0 ? "Start free" : `Choose ${tier.displayName}`}</Link>
              </Button>

              <ul className="mt-5 space-y-2 border-t border-border pt-5">
                {highlights(plan).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Prices exclude VAT and sales tax, which are added at checkout where they apply. Every plan includes the API, SMTP relay, SDKs,
        webhooks, templates and marketing email.
      </p>

      <div className="mt-14">
        <div className="mx-auto mb-6 max-w-xl text-center">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Estimate your bill</h3>
          <p className="mt-1 text-sm text-muted-foreground">Drag the sliders to your monthly volume to see what you&apos;d pay on each plan.</p>
        </div>
        <PricingCalculator />
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Sending more than 500,000 a month?</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            We&apos;ll put together a custom plan with your own limits, dedicated support and, if you need it, isolated infrastructure.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="https://discord.gg/C2Q4GHXKQA">Talk to us</Link>
        </Button>
      </div>
    </Section>
  );
}

export default Pricing;
