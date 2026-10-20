"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@bytesend/ui/src/button";

// Competitor details as published on their pricing and docs pages; re-check before changing claims.
const COMPARISON_CHECKED = "October 2026";

const comparisonRows: { feature: string; bs: string | boolean; resend: string | boolean; sendgrid: string | boolean; postmark: string | boolean; ses: string | boolean }[] = [
    { feature: "Free tier", bs: "5,000/mo (200/day)", resend: "3,000/mo (100/day)", sendgrid: "60-day trial", postmark: "100/mo", ses: "Pay-per-use" },
    { feature: "Marketing campaigns", bs: true, resend: true, sendgrid: true, postmark: "Broadcast API", ses: false },
    { feature: "Visual email editor", bs: true, resend: true, sendgrid: true, postmark: false, ses: false },
    { feature: "Self-hostable", bs: true, resend: false, sendgrid: false, postmark: false, ses: false },
    { feature: "Contact management", bs: true, resend: true, sendgrid: true, postmark: false, ses: "Basic" },
    { feature: "Webhooks", bs: true, resend: true, sendgrid: true, postmark: true, ses: "Via SNS" },
    { feature: "SMTP relay", bs: true, resend: true, sendgrid: true, postmark: true, ses: true },
    { feature: "Analytics dashboard", bs: true, resend: true, sendgrid: true, postmark: true, ses: "Basic" },
    { feature: "Open source", bs: true, resend: false, sendgrid: false, postmark: false, ses: false },
];

const APP_URL = "/login";

export function ComparisonTable() {

    const cols = ["ByteSend", "Resend", "SendGrid", "Postmark", "AWS SES"] as const;
    const vals = (row: (typeof comparisonRows)[0]) => [row.bs, row.resend, row.sendgrid, row.postmark, row.ses] as (string | boolean)[];

    return (
        <section className="py-20 sm:py-28 border-t border-border/30">
            <div className="mx-auto max-w-6xl px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <p className="text-sm font-medium uppercase tracking-wider text-brand-blue dark:text-brand-sky mb-3">Compare</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Why teams choose ByteSend</h2>
                    <p className="mt-4 text-muted-foreground">
                        See how we stack up against Resend, SendGrid, Postmark, and AWS SES.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border/40">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/30">
                                <th className="text-left font-medium text-muted-foreground px-5 py-3.5 w-55">Feature</th>
                                {cols.map((col, i) => (
                                    <th
                                        key={col}
                                        className={`text-center font-semibold px-4 py-3.5 ${i === 0 ? "text-primary" : "text-foreground/70"}`}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonRows.map((row, ri) => (
                                <tr
                                    key={row.feature}
                                    className={`border-b border-border/30 last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/10"}`}
                                >
                                    <td className="px-5 py-3.5 text-muted-foreground font-medium">{row.feature}</td>
                                    {vals(row).map((val, vi) => (
                                        <td
                                            key={vi}
                                            className={`text-center px-4 py-3.5 tabular-nums ${vi === 0 ? "font-medium" : "text-muted-foreground"}`}
                                        >
                                            <CompCell val={val} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                    Based on each provider&apos;s published plans, checked {COMPARISON_CHECKED}. Free tiers for ByteSend and
                    Resend are for transactional email.
                </p>

                <div className="mt-10 text-center">
                    <p className="text-sm text-muted-foreground mb-4">Ready to switch? Migration takes minutes.</p>
                    <Button size="lg" className="px-8 h-12 text-base rounded-xl" asChild>
                        <Link href={APP_URL}>Get started free</Link>
                    </Button>
                </div>
            </div>
        </section>
    );

}

function CompCell({ val }: { val: string | boolean }) {
    if (val === true) return <span className="font-semibold text-brand-teal" aria-label="Yes">✓</span>;
    if (val === false) return <span className="text-muted-foreground/40" aria-label="No">—</span>;
    return <span>{val}</span>;
}

export default ComparisonTable;
