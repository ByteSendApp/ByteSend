import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Acceptable Use Policy – ByteSend",
  description: "Acceptable Use Policy for ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "email-sending", label: "Email Sending Rules" },
  { id: "prohibited-content", label: "Prohibited Content" },
  { id: "platform-abuse", label: "Platform Abuse" },
  { id: "enforcement", label: "Enforcement" },
  { id: "reporting", label: "Reporting Violations" },
];

export default function AcceptableUsePage() {
  if (!env.NEXT_PUBLIC_IS_CLOUD) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-24 lg:flex lg:gap-16">
        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">On this page</p>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Legal</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Acceptable Use Policy</h1>
            <p className="text-muted-foreground leading-relaxed">
              This Acceptable Use Policy (&quot;AUP&quot;) sets out the rules governing use of ByteSend,
              operated by NodeByte LTD. By using ByteSend you agree to comply with this AUP. This policy
              supplements our{" "}
              <a href="/terms" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                Terms of Service
              </a>
              ; in the event of a conflict, the Terms prevail.
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="overview" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Overview</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              ByteSend is an email infrastructure platform designed for legitimate transactional and
              marketing communications. We are committed to maintaining a service that is safe, trustworthy,
              and high-deliverability for all users. Misuse harms not only individual recipients but the
              entire platform&apos;s sending reputation. This policy exists to protect our community,
              recipients, and deliverability.
            </p>
          </section>

          <section id="email-sending" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Email Sending Rules</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              All emails sent via ByteSend must comply with the following requirements:
            </p>
            <div className="space-y-3">
              {[
                {
                  title: "Consent",
                  desc: "You must have explicit, documented consent from every recipient before sending marketing or promotional email. Purchased, rented, or scraped lists are strictly prohibited.",
                },
                {
                  title: "Double opt-in for marketing",
                  desc: "All marketing and newsletter campaigns must use double opt-in verification. Recipients must confirm their subscription before receiving any promotional communications.",
                },
                {
                  title: "Accurate sender identity",
                  desc: "The 'From', 'Reply-To', and 'Sender' fields must accurately identify you or your organisation. Falsifying headers or impersonating another entity is prohibited.",
                },
                {
                  title: "Clear subject lines",
                  desc: "Subject lines must not be deceptive or misleading. They must accurately reflect the content of the email.",
                },
                {
                  title: "Physical address",
                  desc: "Marketing emails must include a valid postal address for your organisation, as required by CAN-SPAM, PECR, and equivalent regulations.",
                },
                {
                  title: "Unsubscribe mechanism",
                  desc: "Every marketing email must include a clear, functional unsubscribe link using the {{bytesend_unsubscribe_url}} variable. You must honour unsubscribe requests within 10 business days.",
                },
                {
                  title: "Suppression list",
                  desc: "You must maintain and honour a suppression list of opted-out and bounced addresses. ByteSend provides built-in suppression tools; you must not attempt to bypass them.",
                },
                {
                  title: "Transactional vs. marketing",
                  desc: "Do not use the transactional email API to send promotional or marketing messages. Transactional API endpoints are for account notifications, password resets, order confirmations, and similar operational communications only.",
                },
              ].map(({ title, desc }) => (
                <div key={title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="prohibited-content" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Prohibited Content</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              You may not send or facilitate the sending of emails containing:
            </p>
            <ul className="space-y-2">
              {[
                "Spam, unsolicited bulk commercial email, or any message sent to a purchased or harvested list.",
                "Phishing, spoofing, or any attempt to fraudulently obtain credentials, financial information, or personal data.",
                "Malware, viruses, ransomware, or any malicious code or attachments.",
                "Content that promotes, glorifies, or facilitates violence, terrorism, or hatred based on protected characteristics.",
                "Child sexual abuse material (CSAM) or any content that sexually exploits or harms minors.",
                "Content that infringes the intellectual property rights of any third party.",
                "Fraudulent or deceptive content, including false claims, pyramid schemes, or advance-fee fraud.",
                "Content that violates any applicable law, including export control regulations, sanctions, or data protection law.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="platform-abuse" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Platform Abuse</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              You may not use ByteSend to:
            </p>
            <ul className="space-y-2">
              {[
                "Probe, scan, or test the vulnerability of our systems, or attempt to circumvent any security or authentication measure.",
                "Access accounts or data that you are not authorised to access.",
                "Introduce any automated traffic, bots, or scripts that place an unreasonable load on our infrastructure.",
                "Use the platform to operate a competing email infrastructure service or resell access without our written permission.",
                "Circumvent usage limits, rate limits, or any other control mechanism.",
                "Harvest or scrape data from the platform without explicit written permission.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="enforcement" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Enforcement</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              NodeByte LTD reserves the right to investigate suspected violations of this AUP. We may take
              any of the following actions, at our sole discretion:
            </p>
            <ul className="space-y-2">
              {[
                "Issue a warning or require remediation.",
                "Temporarily suspend your account or sending capabilities.",
                "Permanently terminate your account.",
                "Report violations to law enforcement, regulatory authorities, or affected third parties.",
                "Remove, disable, or block specific content or email campaigns.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed text-sm mt-4">
              We will endeavour to notify you before taking action where it is safe and practical to do so,
              but we reserve the right to act immediately where necessary to protect the platform, other
              users, or third parties.
            </p>
          </section>

          <section id="reporting" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Reporting Violations</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              If you receive unsolicited email sent via ByteSend, or you believe a user is violating this
              AUP, please report it to{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              . Include as much detail as possible, including email headers where available. We take all
              abuse reports seriously and will investigate promptly.
            </p>
          </section>

          <div className="h-px bg-border/50 mb-6" />
          <p className="text-xs text-muted-foreground">Last updated: 7 May 2026</p>
        </div>
      </div>
    </main>
  );
}
