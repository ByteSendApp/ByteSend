import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { PLANS, type PlanType } from "@bytesend/lib";
import { CallToAction } from "~/components/marketing/CallToAction";
import { Pricing } from "~/components/marketing/PricingSection";
import { Reveal } from "~/components/marketing/Reveal";
import { Section, SectionHeader } from "~/components/marketing/Section";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "Pricing – ByteSend",
  description:
    "Start free with 5,000 emails a month. Paid plans from $5 include a monthly allowance, then you pay per 1,000 emails. Every limit, add-on and answer in one place.",
  alternates: { canonical: "https://bytesend.cloud/pricing" },
};

const PLAN_ORDER: PlanType[] = ["FREE", "HOBBY", "BASIC", "SCALE"];
const number = new Intl.NumberFormat("en-US");
const usd = (value: number) => `$${value.toFixed(2)}`;

type Cell = string | boolean;
interface Row {
  label: string;
  hint?: string;
  value(plan: PlanType): Cell;
}

const limits = (plan: PlanType) => PLANS[plan].limits;
const perThousand = (plan: PlanType, kind: "transactional" | "marketing") => {
  const rate = PLANS[plan].usageMetering?.[kind];
  return rate === undefined ? "Hard limit" : `${usd(rate * 1000)} / 1,000`;
};

const GROUPS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Sending",
    rows: [
      { label: "Price", value: (plan) => (PLANS[plan].monthlyPrice === 0 ? "Free" : `$${PLANS[plan].monthlyPrice / 100} / month`) },
      { label: "Emails included", hint: "Each month", value: (plan) => number.format(limits(plan).monthlyEmailLimit) },
      {
        label: "Daily sending limit",
        value: (plan) => (Number.isFinite(limits(plan).dailyEmailLimit) ? number.format(limits(plan).dailyEmailLimit) : "None"),
      },
      { label: "Extra transactional email", value: (plan) => perThousand(plan, "transactional") },
      { label: "Extra marketing email", value: (plan) => perThousand(plan, "marketing") },
      { label: "SMTP connections at once", value: (plan) => String(limits(plan).concurrentConnections) },
    ],
  },
  {
    title: "Receiving",
    rows: [
      { label: "Received emails", hint: "Each month", value: (plan) => number.format(limits(plan).inboundEmailsPerMonth) },
      { label: "Hosted address and your own domains", value: () => true },
      { label: "DMARC reports", value: () => true },
    ],
  },
  {
    title: "Team and audience",
    rows: [
      { label: "Domains", value: (plan) => String(limits(plan).maxDomains) },
      { label: "Team members", value: (plan) => String(limits(plan).maxTeamMembers) },
      { label: "Marketing contacts", value: (plan) => number.format(limits(plan).contactsLimit) },
      { label: "Contact books", value: (plan) => number.format(limits(plan).maxContactBooks) },
      { label: "Campaigns", hint: "In total", value: (plan) => number.format(limits(plan).campaignsLimit) },
      { label: "Webhooks", value: (plan) => String(limits(plan).maxWebhooks) },
    ],
  },
  {
    title: "Insights and support",
    rows: [
      { label: "Delivery, bounce and complaint tracking", value: () => true },
      { label: "Open and click analytics", value: (plan) => limits(plan).advancedAnalytics },
      { label: "Priority support", value: (plan) => limits(plan).prioritySupport },
    ],
  },
];

const INCLUDED = [
  "REST API, SMTP relay and SDKs for TypeScript, Python and Go",
  "Transactional and marketing email, with templates and a visual editor",
  "Signed webhooks for every email, domain and contact event",
  "Test mode keys that simulate delivery, bounces and complaints",
  "Automatic bounce and complaint suppression",
  "DKIM, SPF and DMARC setup with DNS monitoring",
  "One-click DNS setup for domains on Cloudflare",
  "A choice of AWS sending regions for each domain",
];

const FAQ = [
  {
    q: "How does paying for extra email work?",
    a: "Paid plans include a monthly allowance. If you send more, extra emails are billed per 1,000 at your plan's rate, and the rate gets cheaper on bigger plans. The Free plan has a hard limit instead, so you're never charged.",
  },
  {
    q: "What's the difference between transactional and marketing email?",
    a: "Transactional email is sent to one person because of something they did, like a password reset or receipt, through the API or SMTP. Marketing email is a campaign or broadcast sent to a contact book. Marketing costs a little more because it carries more deliverability risk.",
  },
  {
    q: "What happens when I reach the Free plan's limit?",
    a: "Sending pauses until your allowance resets, and nothing is charged. New accounts also have a lower daily limit during their first week while we check for abuse.",
  },
  {
    q: "Do received emails count toward my sending allowance?",
    a: "No. Received email has its own monthly allowance on every plan, and DMARC reports don't count toward either.",
  },
  {
    q: "Do test mode emails cost anything?",
    a: "No. Emails sent with a test key are never delivered and don't count toward usage. Each team can send up to 1,000 test emails a day.",
  },
  {
    q: "Which currencies can I pay in?",
    a: "US dollars, pounds sterling or euros. Checkout shows prices in your local currency where we support it. Prices exclude VAT and sales tax, which are added at checkout where they apply.",
  },
  {
    q: "Can I change plans or cancel?",
    a: "Yes, at any time from Settings → Billing.",
  },
  {
    q: "Is self-hosting free?",
    a: "Yes. ByteSend is open source under the AGPL-3.0. When you self-host there are no plans or limits, and you pay Amazon SES directly for sending.",
  },
  {
    q: "I send more than 500,000 emails a month.",
    a: "Talk to us on Discord and we'll put together a custom plan with your own limits and dedicated support.",
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto size-4 text-primary" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />;
  return <span>{value}</span>;
}

export default function PricingPage() {
  if (!isCloud()) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Pricing showDetailsLink={false} />

      <Section tinted>
        <SectionHeader eyebrow="Compare plans" title="Every limit, side by side" />
        <Reveal className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 w-56 bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground">Plan</th>
                {PLAN_ORDER.map((plan) => (
                  <th key={plan} className="px-4 py-3 text-center text-xs font-semibold text-foreground">
                    {PLANS[plan].displayName}
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((group) => (
              <tbody key={group.title}>
                <tr className="border-b border-border bg-muted/40">
                  <th colSpan={PLAN_ORDER.length + 1} className="sticky left-0 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/70 last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3 text-foreground">
                      {row.label}
                      {row.hint ? <span className="block text-xs text-muted-foreground">{row.hint}</span> : null}
                    </td>
                    {PLAN_ORDER.map((plan) => (
                      <td key={plan} className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        <CellValue value={row.value(plan)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </Reveal>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Prices in US dollars. Pounds and euros are shown in the plan cards above and at checkout.
        </p>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">Included on every plan</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              No feature gates on the basics. Plans differ in volume and team size, not in what you can build.
            </p>
            <ul className="mt-6 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Wondering how we compare?{" "}
              <Link href="/compare" className="text-primary hover:underline">
                See ByteSend next to Resend, SendGrid, Postmark and Amazon SES
              </Link>
              .
            </p>
          </Reveal>

          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
            <dl className="mt-4 divide-y divide-border/70">
              {FAQ.map((item) => (
                <div key={item.q} className="py-4">
                  <dt className="text-sm font-medium">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      <CallToAction />
    </main>
  );
}
