import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { CallToAction } from "~/components/marketing/CallToAction";
import { ComparisonGrid } from "~/components/marketing/Comparison";
import { Reveal } from "~/components/marketing/Reveal";
import { HairlineGrid, Section, SectionHeader } from "~/components/marketing/Section";
import { highlightCode } from "~/lib/highlighter";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "ByteSend vs Resend, SendGrid, Postmark and Amazon SES",
  description:
    "An honest comparison of ByteSend with Resend, SendGrid, Postmark and sending through Amazon SES directly: features, free tiers, and when each one is the better fit.",
  alternates: { canonical: "https://bytesend.cloud/compare" },
};

const PROVIDERS = [
  {
    name: "Resend",
    them: "You want React Email built in from the people who created it, and a polished, developer-first API.",
    us: "You want the same developer experience with open source code you can self-host, receiving that's out of beta, DMARC reports, and pricing in your own currency.",
  },
  {
    name: "SendGrid",
    them: "You need a long-established provider with enterprise contracts, or you already run on Twilio.",
    us: "You want a simpler product with a permanent free tier instead of a trial, clear pay-as-you-go pricing, and code you can read and run yourself.",
  },
  {
    name: "Postmark",
    them: "You only send transactional email and want a provider focused on nothing else.",
    us: "You send marketing email too, with a visual editor and contact books, and want 5,000 free emails a month to start instead of 100.",
  },
  {
    name: "Amazon SES",
    them: "You have engineers to build bounce handling, suppression lists, dashboards and webhooks yourself, and want the lowest possible raw price.",
    us: "You want all of that already built on top of SES. ByteSend runs on SES, so you can also self-host it on your own AWS account.",
  },
];

const BEFORE = `import { Resend } from "resend";

const resend = new Resend("re_••••••••");

await resend.emails.send({
  from: "hello@yourapp.com",
  to: "jane@example.com",
  subject: "Welcome",
  html: "<p>Thanks for signing up!</p>",
});`;

const AFTER = `import { ByteSend } from "bytesend-js";

const bytesend = new ByteSend("bs_••••••••");

await bytesend.emails.send({
  from: "hello@yourapp.com",
  to: "jane@example.com",
  subject: "Welcome",
  html: "<p>Thanks for signing up!</p>",
});`;

const STEPS = [
  {
    title: "Add your domain",
    text: "Add the DNS records we show you. If your domain is on Cloudflare, paste an API token and we add them for you.",
  },
  {
    title: "Swap your API key or SMTP settings",
    text: "Use our SDK or REST API, or point your existing SMTP setup at smtp.bytesend.cloud on port 587 or 465, with the username from Settings → SMTP and an API key as the password.",
  },
  {
    title: "Test without sending",
    text: "A test API key simulates deliveries, bounces and complaints, with real webhooks, so you can check your integration before any mail goes out.",
  },
  {
    title: "Point your webhooks at ByteSend's events",
    text: "email.delivered, email.bounced, email.complained and the rest arrive signed, with retries. The SDK verifies and types them for you.",
  },
];

export default async function ComparePage() {
  if (!isCloud()) notFound();

  const themes = { dark: "catppuccin-mocha", light: "catppuccin-latte" } as const;
  const [beforeHtml, afterHtml] = await Promise.all([
    highlightCode(BEFORE, { lang: "ts", themes }).catch(() => ""),
    highlightCode(AFTER, { lang: "ts", themes }).catch(() => ""),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Compare</p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">ByteSend and the alternatives</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every email provider is good at something. Here&apos;s an honest look at where ByteSend fits next to Resend, SendGrid, Postmark and
              sending through Amazon SES yourself.
            </p>
          </div>
        </div>
      </section>

      <Section bordered={false}>
        <SectionHeader eyebrow="At a glance" title="Features side by side" align="left" />
        <ComparisonGrid />
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Which one fits" title="When each is the better choice" align="left" />
        <div className="space-y-4">
          {PROVIDERS.map((provider) => (
            <Reveal key={provider.name} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-[15px] font-semibold">ByteSend vs {provider.name}</h3>
              </div>
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                <div className="bg-card p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Choose {provider.name} if</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{provider.them}</p>
                </div>
                <div className="bg-primary/[0.04] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Choose ByteSend if</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{provider.us}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Switching"
          title="Moving over takes an afternoon"
          description="Most of the work is DNS. The code change is usually a few lines."
          align="left"
        />
        <HairlineGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="p-6">
              <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </HairlineGrid>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { label: "Before", html: beforeHtml, code: BEFORE },
            { label: "After", html: afterHtml, code: AFTER },
          ].map((sample) => (
            <div key={sample.label} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border/70 bg-background/95 px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{sample.label}</div>
              {sample.html ? (
                <div
                  className="overflow-x-auto bg-background text-[13px] leading-[1.7] [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:px-5 [&_pre]:py-5"
                  dangerouslySetInnerHTML={{ __html: sample.html }}
                />
              ) : (
                <pre className="overflow-x-auto bg-background px-5 py-5 text-[13px] leading-[1.7] text-foreground/85">
                  <code>{sample.code}</code>
                </pre>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          <Button className="h-10 px-5" asChild>
            <Link href="/signup">
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" className="h-10 px-5" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </Section>

      <CallToAction />
    </main>
  );
}
