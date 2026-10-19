import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Privacy Policy – ByteSend",
  description: "Privacy policy for ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "who-we-are", label: "Who We Are" },
  { id: "what-we-collect", label: "What We Collect" },
  { id: "how-we-use", label: "How We Use It" },
  { id: "legal-bases", label: "Legal Bases" },
  { id: "sharing", label: "Sharing & Processors" },
  { id: "retention", label: "Retention" },
  { id: "transfers", label: "International Transfers" },
  { id: "your-rights", label: "Your Rights" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes" },
];

export default function PrivacyPage() {
  if (!env.NEXT_PUBLIC_IS_CLOUD) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24 lg:flex lg:gap-16">
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy explains how NodeByte LTD (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
              collects, uses, and protects information when you visit or use bytesend.cloud and the ByteSend
              application. By using our platform you agree to the practices described here.
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="who-we-are" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Who We Are</h2>
            <p className="text-muted-foreground leading-relaxed">
              NodeByte LTD is a company registered in England and Wales. We operate bytesend.cloud and host the
              application on infrastructure managed by NodeByte Hosting, a division of NodeByte LTD.
              For any privacy-related questions, contact us at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid transition-all">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </section>

          <section id="what-we-collect" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">What We Collect</h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium mb-1">Usage &amp; analytics data</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use Simple Analytics for privacy-friendly, aggregate traffic insights. Simple Analytics
                  does not use cookies and does not collect personally identifiable information.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium mb-1">Server &amp; security logs</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our hosting infrastructure (NodeByte Hosting) transiently processes IP addresses and basic
                  HTTP request metadata for security monitoring, DDoS mitigation, and debugging. These logs
                  are not linked to individual user accounts.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium mb-1">Account &amp; profile data</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you create a ByteSend account we process your name, email address, and OAuth identity
                  (e.g. GitHub or Google). We use this to authenticate you, send transactional account emails,
                  and provide the service.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium mb-1">Email sending data</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you send emails via ByteSend we store metadata such as recipient addresses, subject
                  lines, send timestamps, and delivery status (bounces, complaints, opens). This data is
                  associated with your team account.
                </p>
              </div>
            </div>
          </section>

          <section id="how-we-use" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">How We Use Information</h2>
            <ul className="space-y-2 text-muted-foreground leading-relaxed">
              {[
                "Provide, operate, and maintain the ByteSend platform and associated services.",
                "Authenticate users and protect account security.",
                "Detect and prevent fraud, abuse, and violations of our Terms of Service.",
                "Deliver transactional and account-related emails (e.g. magic links, invoices).",
                "Understand aggregate usage patterns to improve the product.",
                "Comply with legal and regulatory obligations.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section id="legal-bases" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Legal Bases (UK &amp; EEA)</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              Where the UK GDPR or EU GDPR applies, we process personal data under the following legal bases:
            </p>
            <ul className="space-y-2">
              {[
                { basis: "Contract performance", desc: "Processing necessary to provide the service you have signed up for, including authentication and transactional emails." },
                { basis: "Legitimate interests", desc: "Operating and securing our infrastructure, detecting abuse, and measuring aggregate product usage, balanced against your rights and interests." },
                { basis: "Legal obligation", desc: "Retaining records where required by law, and responding to lawful requests from authorities." },
                { basis: "Consent", desc: "Where we rely on consent (e.g. optional communications), you may withdraw it at any time." },
              ].map(({ basis, desc }) => (
                <li key={basis} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <span className="font-medium">{basis}:</span>{" "}
                  <span className="text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="sharing" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Sharing &amp; Processors</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              We do not sell your personal information. We share data only with the following sub-processors
              where necessary to deliver the service:
            </p>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Processor</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Purpose</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    { p: "NodeByte Hosting", purpose: "Application hosting, networking, security", loc: "United Kingdom" },
                    { p: "Amazon Web Services (SES)", purpose: "Transactional email delivery", loc: "EU / US" },
                    { p: "Simple Analytics", purpose: "Privacy-friendly aggregate analytics", loc: "Netherlands" },
                    { p: "Stripe", purpose: "Payment processing and billing", loc: "United States" },
                  ].map(({ p, purpose, loc }) => (
                    <tr key={p}>
                      <td className="px-4 py-3 font-medium">{p}</td>
                      <td className="px-4 py-3 text-muted-foreground">{purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="retention" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Retention</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We retain personal data only for as long as necessary to fulfil the purposes set out in this
              policy, or as required by law. Account data is retained for the lifetime of your account and
              for a reasonable period after deletion to comply with legal obligations. Email sending logs
              are retained for up to 12 months. You may request deletion of your data at any time by
              contacting{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </section>

          <section id="transfers" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">International Transfers</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Some of our sub-processors operate outside the UK and EEA. Where personal data is transferred
              internationally, we ensure appropriate safeguards are in place, including the use of UK
              International Data Transfer Agreements (IDTAs) or EU Standard Contractual Clauses (SCCs)
              where applicable.
            </p>
          </section>

          <section id="your-rights" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              Under the UK GDPR and Data Protection Act 2018, you have the following rights:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { right: "Access", desc: "Request a copy of your personal data." },
                { right: "Rectification", desc: "Ask us to correct inaccurate data." },
                { right: "Erasure", desc: "Request deletion of your data where no legal basis exists for retention." },
                { right: "Restriction", desc: "Ask us to pause processing in certain circumstances." },
                { right: "Portability", desc: "Receive your data in a structured, machine-readable format." },
                { right: "Objection", desc: "Object to processing based on legitimate interests." },
              ].map(({ right, desc }) => (
                <li key={right} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <span className="font-medium">{right}:</span>{" "}
                  <span className="text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed text-sm mt-4">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              . You also have the right to lodge a complaint with the UK Information Commissioner&apos;s
              Office (ICO) at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                ico.org.uk
              </a>
              .
            </p>
          </section>

          <section id="children" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Children</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              ByteSend is intended for business use and is not directed to individuals under the age of 16.
              We do not knowingly collect personal information from children. If you believe we have
              inadvertently collected such data, please contact us immediately.
            </p>
          </section>

          <section id="changes" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We may update this policy from time to time. When we make material changes we will update the
              &quot;Last updated&quot; date below and, where appropriate, notify you by email or via an
              in-app notice. Continued use of the platform after changes are posted constitutes your
              acceptance of the revised policy.
            </p>
          </section>

          <div className="h-px bg-border/50 mb-6" />
          <p className="text-xs text-muted-foreground">Last updated: 7 May 2026</p>
        </div>
      </div>
    </main>
  );
}
