"use client";

import React from "react";
import { Check, Minus } from "lucide-react";
import { Reveal } from "./Reveal";

// Competitor details as published on their pricing and docs pages; re-check before changing claims.
export const COMPARISON_CHECKED = "October 2026";

export const comparisonRows: { feature: string; bs: string | boolean; resend: string | boolean; sendgrid: string | boolean; postmark: string | boolean; ses: string | boolean }[] = [
    { feature: "Free tier", bs: "5,000/mo (200/day)", resend: "3,000/mo (100/day)", sendgrid: "60-day trial", postmark: "100/mo", ses: "Pay-per-use" },
    { feature: "Marketing campaigns", bs: true, resend: true, sendgrid: true, postmark: "Broadcast API", ses: false },
    { feature: "Visual email editor", bs: true, resend: true, sendgrid: true, postmark: false, ses: false },
    { feature: "Self-hostable", bs: true, resend: false, sendgrid: false, postmark: false, ses: false },
    { feature: "Contact management", bs: true, resend: true, sendgrid: true, postmark: false, ses: "Basic" },
    { feature: "Webhooks", bs: true, resend: true, sendgrid: true, postmark: true, ses: "Via SNS" },
    { feature: "Inbound email", bs: true, resend: "Beta", sendgrid: "Inbound Parse", postmark: true, ses: "Via S3 and SNS" },
    { feature: "DMARC reports", bs: true, resend: false, sendgrid: false, postmark: "Paid add-on", ses: false },
    { feature: "Test mode", bs: "Test API keys", resend: "Test addresses", sendgrid: "Sandbox mode", postmark: "Test token", ses: "Simulator addresses" },
    { feature: "SMTP relay", bs: true, resend: true, sendgrid: true, postmark: true, ses: true },
    { feature: "Analytics dashboard", bs: true, resend: true, sendgrid: true, postmark: true, ses: "Basic" },
    { feature: "Open source", bs: true, resend: false, sendgrid: false, postmark: false, ses: false },
];

export function ComparisonGrid() {
    const cols = ["ByteSend", "Resend", "SendGrid", "Postmark", "AWS SES"] as const;
    const vals = (row: (typeof comparisonRows)[0]) => [row.bs, row.resend, row.sendgrid, row.postmark, row.ses] as (string | boolean)[];

    return (
        <>
            <Reveal className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full border-collapse text-[13px]">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="w-52 px-4 py-3 text-left text-xs font-medium text-muted-foreground">Feature</th>
                            {cols.map((col, i) => (
                                <th
                                    key={col}
                                    className={`px-4 py-3 text-center text-xs font-semibold ${i === 0 ? "bg-primary/[0.06] text-primary" : "text-muted-foreground"}`}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {comparisonRows.map((row) => (
                            <tr key={row.feature} className="border-b border-border/70 last:border-0">
                                <td className="px-4 py-3 font-medium text-foreground">{row.feature}</td>
                                {vals(row).map((val, vi) => (
                                    <td
                                        key={vi}
                                        className={`px-4 py-3 text-center tabular-nums ${vi === 0 ? "bg-primary/[0.06] font-medium text-foreground" : "text-muted-foreground"}`}
                                    >
                                        <CompCell val={val} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Reveal>

            <p className="mt-3 text-center text-xs text-muted-foreground">
                Based on each provider&apos;s published plans, checked {COMPARISON_CHECKED}.
            </p>
        </>
    );
}

function CompCell({ val }: { val: string | boolean }) {
    if (val === true) return <Check className="mx-auto size-4 text-primary" aria-label="Yes" />;
    if (val === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="No" />;
    return <span>{val}</span>;
}

export default ComparisonGrid;
