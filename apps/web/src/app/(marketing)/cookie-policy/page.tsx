import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Cookie Policy – ByteSend",
  description: "Cookie policy for ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "what-are-cookies", label: "What Are Cookies" },
  { id: "what-we-use", label: "What We Use" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "your-choices", label: "Your Choices" },
  { id: "contact", label: "Contact" },
];

export default function CookiePolicyPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground leading-relaxed">
              This Cookie Policy explains how NodeByte LTD (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
              uses cookies and similar tracking technologies on bytesend.cloud. This policy should be read
              alongside our{" "}
              <a href="/privacy" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="what-are-cookies" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">What Are Cookies</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Cookies are small text files that a website stores on your device when you visit. They are
              widely used to make websites work, to improve efficiency, and to provide information to site
              owners. Similar technologies include local storage, session storage, and pixels.
            </p>
          </section>

          <section id="what-we-use" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">What We Use</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              We aim to keep our use of cookies minimal. The cookies we set fall into the following
              categories:
            </p>
            <div className="space-y-3">
              {[
                {
                  name: "Strictly necessary",
                  required: true,
                  desc: "These cookies are essential for the platform to function. They include session tokens required to keep you logged in and CSRF protection tokens. Without these cookies, services you have requested cannot be provided. These cannot be disabled.",
                },
                {
                  name: "Functional / preference",
                  required: true,
                  desc: "Used to remember your preferences such as sidebar state and theme. These do not track you across sites.",
                },
              ].map(({ name, required, desc }) => (
                <div key={name} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-sm font-medium">{name}</p>
                    {required && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Always active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium mb-1.5">We do <em>not</em> use tracking or advertising cookies</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ByteSend does not set any third-party advertising cookies, retargeting pixels, or
                cross-site tracking cookies. We do not build advertising profiles.
              </p>
            </div>
          </section>

          <section id="third-party" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Third-Party Services</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Service</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Purpose</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Cookies / Storage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {[
                    { service: "Simple Analytics", purpose: "Aggregate, privacy-friendly analytics", cookies: "None (no cookies or fingerprinting)" },
                    { service: "Stripe", purpose: "Payment processing (billing pages only)", cookies: "Stripe sets cookies for fraud prevention and session management on payment flows" },
                  ].map(({ service, purpose, cookies }) => (
                    <tr key={service}>
                      <td className="px-4 py-3 font-medium">{service}</td>
                      <td className="px-4 py-3 text-muted-foreground">{purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{cookies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="your-choices" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Your Choices</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              You can control cookies through your browser settings. Most browsers allow you to refuse
              cookies, delete existing cookies, or be notified when a cookie is set. Note that disabling
              strictly necessary cookies will prevent the application from working correctly.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              For more information on managing cookies, visit{" "}
              <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                allaboutcookies.org
              </a>
              . Under UK PECR and the EU ePrivacy Directive, you have the right to refuse non-essential
              cookies.
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Questions about our use of cookies? Contact us at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </section>

          <div className="h-px bg-border/50 mb-6" />
          <p className="text-xs text-muted-foreground">Last updated: 7 May 2026</p>
        </div>
      </div>
    </main>
  );
}
