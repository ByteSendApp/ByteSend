import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "DMCA Policy – ByteSend",
  description: "DMCA copyright takedown policy for ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "submit-notice", label: "Submit a Notice" },
  { id: "required-info", label: "Required Information" },
  { id: "counter-notice", label: "Counter-Notice" },
  { id: "repeat-infringers", label: "Repeat Infringers" },
  { id: "contact", label: "Contact" },
];

export default function DmcaPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">DMCA Policy</h1>
            <p className="text-muted-foreground leading-relaxed">
              NodeByte LTD respects the intellectual property rights of others and expects users of
              ByteSend to do the same. This policy outlines our process for handling copyright infringement
              claims under the Digital Millennium Copyright Act (DMCA) and equivalent UK and international
              copyright law.
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="overview" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Overview</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              If you believe that material available on or through ByteSend infringes your copyright, you
              may submit a written notice to our designated copyright agent. We will review valid notices
              promptly and take appropriate action, which may include removing or disabling access to the
              allegedly infringing material.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Please note that submitting a false or misleading infringement notice may expose you to legal
              liability, including damages, under 17 U.S.C. § 512(f) or equivalent law.
            </p>
          </section>

          <section id="submit-notice" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">How to Submit a Notice</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              Send your DMCA takedown notice to our designated copyright agent by email:
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Copyright Agent: NodeByte LTD</p>
                <p className="text-sm text-muted-foreground mt-0.5">Designated agent for copyright matters</p>
              </div>
              <a
                href="mailto:dmca@nodebyte.co.uk"
                className="text-sm font-medium text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid shrink-0"
              >
                dmca@nodebyte.co.uk
              </a>
            </div>
          </section>

          <section id="required-info" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Required Information</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              To be valid, your notice must include all of the following:
            </p>
            <ol className="space-y-3">
              {[
                "An electronic or physical signature of the person authorised to act on behalf of the owner of the copyright interest.",
                "A description of the copyrighted work that you claim has been infringed, including a URL or other identifying information sufficient to locate it.",
                "A description of the material you claim is infringing, and information sufficient for us to locate that material on ByteSend (e.g. a URL).",
                "Your name, address, telephone number, and email address.",
                "A statement that you have a good-faith belief that the disputed use is not authorised by the copyright owner, its agent, or the law.",
                "A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on the copyright owner's behalf.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section id="counter-notice" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Counter-Notice</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              If you believe that material was removed or disabled as a result of a mistake or
              misidentification, you may submit a counter-notice to{" "}
              <a href="mailto:dmca@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                dmca@nodebyte.co.uk
              </a>
              . Your counter-notice must include:
            </p>
            <ul className="space-y-2">
              {[
                "Your physical or electronic signature.",
                "Identification of the material that was removed or disabled and the location where it appeared before removal.",
                "A statement under penalty of perjury that you have a good-faith belief the material was removed or disabled as a result of mistake or misidentification.",
                "Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the courts of England and Wales.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed text-sm mt-4">
              Upon receipt of a valid counter-notice, we will forward it to the original complainant. If the
              complainant does not notify us within 10 business days that they have filed a legal action, we
              may restore the removed material.
            </p>
          </section>

          <section id="repeat-infringers" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Repeat Infringers</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              NodeByte LTD has a policy of terminating, in appropriate circumstances, the accounts of users
              who are found to be repeat infringers of intellectual property rights. We reserve the right to
              make this determination at our sole discretion.
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              For all copyright and DMCA matters, contact our designated agent at{" "}
              <a href="mailto:dmca@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                dmca@nodebyte.co.uk
              </a>
              . For general legal enquiries, contact{" "}
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
