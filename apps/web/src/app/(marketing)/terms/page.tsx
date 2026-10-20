import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Terms of Service – ByteSend",
  description: "Terms governing use of ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "eligibility", label: "Eligibility & Accounts" },
  { id: "acceptable-use", label: "Acceptable Use" },
  { id: "anti-spam", label: "Anti-Spam" },
  { id: "payment", label: "Payment & Billing" },
  { id: "ip", label: "Intellectual Property" },
  { id: "third-party", label: "Third-Party Links" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes & Availability" },
  { id: "governing-law", label: "Governing Law" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of bytesend.cloud and
              the ByteSend application, operated by NodeByte LTD, a company registered in England and Wales.
              By accessing or using our platform you agree to be bound by these Terms. If you do not agree,
              do not use the platform.
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="eligibility" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Eligibility &amp; Accounts</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              You may use the platform only if you are at least 16 years old, can form a binding contract
              with NodeByte LTD, and are not prohibited from doing so under applicable law. You are
              responsible for maintaining the confidentiality of your account credentials and for all
              activity that occurs under your account. Notify us immediately at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>{" "}
              if you suspect unauthorised access.
            </p>
          </section>

          <section id="acceptable-use" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              You agree not to misuse the platform. Prohibited conduct includes, without limitation:
            </p>
            <ul className="space-y-2">
              {[
                "Violating any applicable laws or regulations, including the UK GDPR, the Privacy and Electronic Communications Regulations (PECR), and the CAN-SPAM Act.",
                "Infringing the intellectual property or privacy rights of any third party.",
                "Sending unsolicited bulk communications (spam) or harvesting email addresses without consent.",
                "Attempting to probe, scan, or test the vulnerability of the platform or circumvent any security measure.",
                "Uploading, transmitting, or distributing malicious code, viruses, or any software designed to damage or disrupt systems.",
                "Impersonating another person or entity, or misrepresenting your affiliation with any person or entity.",
                "Engaging in any activity that places an unreasonable load on our infrastructure.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="anti-spam" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Anti-Spam Enforcement</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              To protect our community and email deliverability, all marketing or promotional communications
              sent via ByteSend must use double opt-in verification. You must maintain a suppression list
              and honour unsubscribe requests promptly.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Accounts found sending unsolicited bulk email, bypassing double opt-in, or misusing the
              transactional API for promotional campaigns may be suspended or terminated immediately and
              without notice. We reserve the right to report repeat violations to relevant authorities.
            </p>
          </section>

          <section id="payment" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Payment &amp; Billing</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              Paid plans are billed in advance on a recurring basis. All fees are exclusive of VAT or
              applicable taxes, which will be added where required by law. Payments are processed by Stripe.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              If your payment fails, access to paid features may be suspended until payment is received.
              You may cancel your subscription at any time; access will remain active until the end of the
              current billing period. We do not provide refunds for partial periods unless required by law.
            </p>
          </section>

          <section id="ip" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              The ByteSend platform, including its software, trademarks, logos, and documentation, is owned
              by or licensed to NodeByte LTD and protected by UK and international intellectual property
              laws. You are granted a limited, non-exclusive, non-transferable licence to use the platform
              solely for your own internal business purposes. You may not copy, modify, distribute, sell,
              or lease any part of the platform, nor may you reverse-engineer it, except as permitted by
              applicable law. Your content remains yours; by uploading it you grant us a limited licence to
              process it solely to deliver the service.
            </p>
          </section>

          <section id="third-party" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Third-Party Links &amp; Integrations</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              The platform may contain links to or integrate with third-party websites and services that we
              do not control. We are not responsible for their content, privacy practices, or availability.
              Your use of any third-party service is governed by that service&apos;s own terms.
            </p>
          </section>

          <section id="disclaimer" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              To the fullest extent permitted by law, the platform is provided on an &quot;as is&quot; and
              &quot;as available&quot; basis without warranties of any kind, whether express, implied,
              statutory, or otherwise, including warranties of merchantability, fitness for a particular
              purpose, or non-infringement. We do not warrant that the platform will be uninterrupted,
              error-free, or free of viruses or other harmful components.
            </p>
          </section>

          <section id="liability" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              To the fullest extent permitted by applicable law, NodeByte LTD shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of profits,
              revenue, data, goodwill, or other intangible losses arising out of or in connection with these
              Terms or your use of the platform.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Our aggregate liability to you for any claim arising under these Terms shall not exceed the
              greater of (a) the amount you paid to us in the 12 months preceding the claim, or (b) £100.
              Nothing in these Terms excludes or limits our liability for death or personal injury caused
              by negligence, fraud, or any other liability that cannot be excluded by English law.
            </p>
          </section>

          <section id="indemnification" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              You agree to defend, indemnify, and hold harmless NodeByte LTD and its officers, directors,
              employees, and agents from and against any claims, damages, liabilities, costs, and expenses
              (including reasonable legal fees) arising out of or related to your use of the platform, your
              content, or your violation of these Terms or applicable law.
            </p>
          </section>

          <section id="termination" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Termination</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We may suspend or terminate your access to the platform at any time, with or without notice,
              for conduct that we determine violates these Terms or is harmful to other users, us, or third
              parties, or for any other reason at our sole discretion. You may terminate your account at
              any time via account settings. Termination does not entitle you to a refund of any prepaid
              fees, except where required by applicable law.
            </p>
          </section>

          <section id="changes" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Changes &amp; Availability</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We reserve the right to modify these Terms at any time. Material changes will be communicated
              by updating the &quot;Last updated&quot; date and, where appropriate, by email or in-app
              notification. Your continued use of the platform after changes are posted constitutes
              acceptance of the revised Terms. We may also suspend, modify, or discontinue the platform
              or any part of it at any time without liability.
            </p>
          </section>

          <section id="governing-law" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Governing Law &amp; Jurisdiction</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              These Terms are governed by and construed in accordance with the laws of England and Wales.
              Any dispute arising out of or in connection with these Terms shall be subject to the exclusive
              jurisdiction of the courts of England and Wales, except where mandatory local law provides
              otherwise.
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Questions about these Terms? Reach us at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              . NodeByte LTD, registered in England and Wales.
            </p>
          </section>

          <div className="h-px bg-border/50 mb-6" />
          <p className="text-xs text-muted-foreground">Last updated: 7 May 2026</p>
        </div>
      </div>
    </main>
  );
}
