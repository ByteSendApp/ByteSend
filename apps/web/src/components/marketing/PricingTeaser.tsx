import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLANS, SOLD_PAID_PLANS, type PlanType } from "@bytesend/lib";
import { Button } from "@bytesend/ui/src/button";
import { Reveal } from "./Reveal";
import { HairlineGrid, Section, SectionHeader } from "./Section";

const PLAN_ORDER: PlanType[] = ["FREE", ...SOLD_PAID_PLANS];
const number = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const lowestRate = Math.min(...SOLD_PAID_PLANS.map((plan) => PLANS[plan].usageMetering?.transactional ?? Number.POSITIVE_INFINITY)) * 1000;

export function PricingTeaser() {
  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow="Pricing"
        title="Free to start. Pay for what you send."
        description={`Every plan includes a monthly allowance. Go over it and extra email is billed per 1,000, from $${lowestRate.toFixed(2)}. Prices in dollars, pounds or euros.`}
      />

      <Reveal>
        <HairlineGrid className="grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((plan) => {
            const tier = PLANS[plan];
            return (
              <div key={plan} className="p-5 sm:p-6">
                <p className="text-sm font-medium text-foreground">{tier.displayName}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {tier.monthlyPrice === 0 ? "Free" : `$${tier.monthlyPrice / 100}`}
                  {tier.monthlyPrice > 0 ? <span className="text-sm font-normal text-muted-foreground"> / month</span> : null}
                </p>
                <p className="mt-3 text-[13px] text-muted-foreground">{number.format(tier.limits.monthlyEmailLimit)} emails a month</p>
                <p className="text-[13px] text-muted-foreground">{number.format(tier.limits.inboundEmailsPerMonth)} received</p>
              </div>
            );
          })}
        </HairlineGrid>
      </Reveal>

      <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
        <Button className="h-10 px-5" asChild>
          <Link href="/pricing">
            See full pricing
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button variant="outline" className="h-10 px-5" asChild>
          <Link href="/signup">Start free</Link>
        </Button>
      </div>
    </Section>
  );
}

export default PricingTeaser;
