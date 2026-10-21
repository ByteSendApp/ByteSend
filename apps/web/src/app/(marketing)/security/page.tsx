import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "Security – ByteSend",
  description: "How ByteSend protects your account, your email and your data, who processes it, and how to report a vulnerability.",
  alternates: { canonical: "https://bytesend.cloud/security" },
};

const SECTIONS: Array<{ id: string; title: string; items: string[] }> = [
  {
    id: "data",
    title: "Your data",
    items: [
      "All traffic to and from ByteSend is encrypted with TLS, and the database is encrypted at rest.",
      "API keys are stored as one-way scrypt hashes. We show a key once, when you create it, and can't recover it afterwards.",
      "Received email and its attachments are deleted after 30 days, DMARC reports after 90 days, and email sending logs after up to 12 months.",
      "Access to customer data is limited to staff who need it, and staff actions on accounts are recorded in an audit log.",
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    items: [
      "Sign in with GitHub, Google, Discord, an email link, or a password.",
      "Two-factor authentication with any authenticator app, with recovery codes in case you lose your device.",
      "API keys can be limited to a single domain, and test keys can never send real email.",
    ],
  },
  {
    id: "email",
    title: "Your email",
    items: [
      "Webhooks are signed with HMAC-SHA256 and a timestamp, so you can verify they came from us and reject replays.",
      "Links to received attachments are signed, expire after an hour, and always download rather than open in the browser.",
      "Received HTML is shown in a sandboxed frame with no scripts. Incoming mail is scanned for spam and viruses, and infected mail is never forwarded.",
      "Outgoing mail is scanned for phishing and abuse before it's queued, and hard bounces and complaints are suppressed automatically.",
      "Domains are re-checked twice a day, and you're told if a DKIM, SPF or MX record changes.",
    ],
  },
  {
    id: "open-source",
    title: "Open source",
    items: [
      "ByteSend's code is public under the AGPL-3.0, so anyone can review how your email and data are handled.",
      "Dependencies are kept up to date, and fixes for security issues ship in the latest and previous stable releases.",
    ],
  },
];

const PROCESSORS = [
  { name: "NodeByte Hosting", role: "Application hosting, database and networking", location: "United Kingdom" },
  { name: "Amazon Web Services (SES, S3)", role: "Sending and receiving email, and storing received email", location: "EU / US" },
  { name: "Stripe", role: "Payment processing and billing", location: "United States" },
  { name: "Simple Analytics", role: "Privacy-friendly aggregate website analytics", location: "Netherlands" },
];

export default function SecurityPage() {
  if (!isCloud()) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Security</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Keeping your email safe</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          How we protect your account, your email and your data, who helps us process it, and how to tell us about a problem.
        </p>

        <div className="mt-12 space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span className="leading-relaxed text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section id="sub-processors" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight">Who processes your data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The companies that help us run ByteSend. Our{" "}
              <Link href="/dpa" className="text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid">
                Data Processing Agreement
              </Link>{" "}
              covers how we use them.
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">What for</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Where</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {PROCESSORS.map((processor) => (
                    <tr key={processor.name}>
                      <td className="px-4 py-3 font-medium">{processor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{processor.role}</td>
                      <td className="px-4 py-3 text-muted-foreground">{processor.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="report" className="scroll-mt-24 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold tracking-tight">Report a vulnerability</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Please don&apos;t open a public GitHub issue. Email{" "}
              <a href="mailto:security@nodebyte.co.uk" className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid">
                security@nodebyte.co.uk
              </a>{" "}
              with <span className="font-mono text-xs">[SECURITY]</span> in the subject, and include the affected component, steps to reproduce, and
              the impact.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>We acknowledge reports within 72 hours.</li>
              <li>We assess severity, plan a fix, and agree disclosure with you.</li>
              <li>If you&apos;d like, we credit you in the release notes.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              In scope: remote code execution, authentication bypass, data exposure, injection, and SSRF. Missing best-practice headers, self-XSS and
              rate-limit bypasses with no real impact are out of scope.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
