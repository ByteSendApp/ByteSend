"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@bytesend/ui/src/button";
import { PricingCalculator } from "~/components/marketing/PricingCalculator";

export function Pricing() {

    return (
        <section id="pricing" className="py-20 sm:py-28 border-t border-border/30">
            <div className="mx-auto max-w-6xl px-6">
                <div className="text-center max-w-2xl mx-auto mb-14">
                    <p className="text-sm font-medium uppercase tracking-wider text-brand-blue dark:text-brand-sky mb-3">Pricing</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Simple pricing that grows with you
                    </h2>
                    <p className="mt-4 text-muted-foreground">
                        Start free with 5,000 emails a month. Estimate a paid plan for your
                        transactional and marketing volume below, then pick it in the dashboard when you're ready.
                    </p>
                </div>

                <PricingCalculator />

                <div className="mt-6 rounded-2xl border border-border/40 bg-card/40 px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Need dedicated pricing or high-volume support?</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            For custom throughput, compliance, or infrastructure isolation, we can tailor a plan for your workload.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
                        <Link href="https://discord.gg/C2Q4GHXKQA">Contact us →</Link>
                    </Button>
                </div>

            </div>
        </section>
    );
}

export default Pricing;
