import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Data Processing Agreement – ByteSend",
  description: "Data Processing Agreement (DPA) for ByteSend, operated by NodeByte LTD.",
};

const sections = [
  { id: "background", label: "Background" },
  { id: "definitions", label: "Definitions" },
  { id: "scope", label: "Scope & Roles" },
  { id: "obligations", label: "Our Obligations" },
  { id: "sub-processors", label: "Sub-Processors" },
  { id: "security", label: "Security" },
  { id: "data-subject-rights", label: "Data Subject Rights" },
  { id: "breach", label: "Data Breach" },
  { id: "transfers", label: "International Transfers" },
  { id: "deletion", label: "Deletion & Return" },
  { id: "contact", label: "Contact" },
];

export default function DpaPage() {
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
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Data Processing Agreement</h1>
            <p className="text-muted-foreground leading-relaxed">
              This Data Processing Agreement (&quot;DPA&quot;) forms part of the agreement between NodeByte
              LTD (&quot;we&quot;, &quot;us&quot;, &quot;Processor&quot;) and you (&quot;Controller&quot;)
              for use of the ByteSend platform. It sets out the terms on which we process personal data on
              your behalf, as required by the UK GDPR, the Data Protection Act 2018, and equivalent
              legislation.
            </p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 mb-10">
            <p className="text-sm font-medium mb-1">This DPA is incorporated into our Terms of Service</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accepting our{" "}
              <a href="/terms" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                Terms of Service
              </a>{" "}
              you also agree to this DPA. If you require a signed copy for compliance purposes, contact{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </div>

          <div className="h-px bg-border/50 mb-10" />

          <section id="background" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Background</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              When you use ByteSend to send emails to your contacts, you act as the data controller of the
              personal data contained in those emails (e.g. recipient names and addresses). NodeByte LTD
              acts as the data processor, processing that personal data on your behalf and under your
              instructions. This DPA governs that processing relationship.
            </p>
          </section>

          <section id="definitions" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Definitions</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/70">
                  {[
                    { term: "Personal Data", def: "Any information relating to an identified or identifiable natural person, as defined in the UK GDPR." },
                    { term: "Processing", def: "Any operation performed on personal data, including collection, storage, use, disclosure, or deletion." },
                    { term: "Controller", def: "The entity that determines the purposes and means of processing personal data. That's you, the ByteSend customer." },
                    { term: "Processor", def: "The entity that processes personal data on behalf of the Controller. That's NodeByte LTD." },
                    { term: "Sub-Processor", def: "A third party engaged by the Processor to assist in processing personal data on behalf of the Controller." },
                    { term: "Data Subject", def: "The individual whose personal data is being processed, typically your email recipients or contacts." },
                  ].map(({ term, def }) => (
                    <tr key={term}>
                      <td className="px-4 py-3 font-medium w-36 align-top">{term}</td>
                      <td className="px-4 py-3 text-muted-foreground leading-relaxed">{def}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="scope" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Scope &amp; Roles</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              This DPA applies to the following categories of personal data processed via ByteSend:
            </p>
            <ul className="space-y-2 mb-4">
              {[
                "Email addresses and names of your email recipients and contact book subscribers.",
                "Email engagement metadata (opens, clicks, bounces, complaints) where applicable.",
                "Any personal data contained in the body, subject, or headers of emails you send.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed text-sm">
              The lawful basis for processing, and the purposes for which you collect and use your
              contacts&apos; data, are your responsibility as Controller. NodeByte LTD processes this data
              solely as instructed by you and as necessary to provide the ByteSend service.
            </p>
          </section>

          <section id="obligations" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Our Obligations as Processor</h2>
            <ul className="space-y-2">
              {[
                "Process personal data only on your documented instructions, unless required to do so by law.",
                "Ensure that all personnel authorised to process personal data are bound by appropriate confidentiality obligations.",
                "Implement appropriate technical and organisational security measures (see Security section).",
                "Assist you in fulfilling your obligations to data subjects under the UK GDPR, including responding to access requests.",
                "Notify you promptly in the event of a personal data breach that affects data we process on your behalf.",
                "Delete or return all personal data to you at the end of the service relationship, at your election.",
                "Make available all information necessary to demonstrate compliance with this DPA and allow for audits upon reasonable notice.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="sub-processors" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Sub-Processors</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-4">
              By accepting this DPA you provide general authorisation for us to engage the following
              sub-processors. We will notify you of any material changes to this list.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Sub-Processor</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {[
                    { name: "NodeByte Hosting", role: "Application hosting and infrastructure", loc: "United Kingdom" },
                    { name: "Amazon Web Services (SES)", role: "Email delivery infrastructure", loc: "EU / US" },
                    { name: "Upstash (Redis)", role: "Queue processing and caching", loc: "EU" },
                  ].map(({ name, role, loc }) => (
                    <tr key={name}>
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{role}</td>
                      <td className="px-4 py-3 text-muted-foreground">{loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="security" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Security Measures</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-3">
              We implement appropriate technical and organisational measures to protect personal data,
              including:
            </p>
            <ul className="space-y-2">
              {[
                "Encryption in transit (TLS) for all data transmitted to and from our platform.",
                "Encryption at rest for database storage.",
                "Access controls limiting personnel access to personal data to those with a legitimate need.",
                "Regular security monitoring, vulnerability assessments, and dependency updates.",
                "Suppression list management to prevent repeat delivery to opted-out addresses.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-muted-foreground leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="data-subject-rights" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Data Subject Rights</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              As Controller, you are responsible for responding to data subject requests (access,
              rectification, erasure, etc.) from your contacts. We will assist you by providing the
              technical means to export, correct, or delete contact data held within ByteSend, and we will
              forward any data subject requests we receive directly to you without undue delay.
            </p>
          </section>

          <section id="breach" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Data Breach Notification</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              In the event of a personal data breach affecting data we process on your behalf, we will
              notify you without undue delay and in any event within 72 hours of becoming aware of the
              breach, to the extent practicable. The notification will include the nature of the breach,
              categories and approximate volume of data subjects and records affected, likely consequences,
              and measures taken or proposed to address the breach.
            </p>
          </section>

          <section id="transfers" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">International Transfers</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Where personal data is transferred to sub-processors outside the UK or EEA, we ensure
              appropriate safeguards are in place, including UK International Data Transfer Agreements
              (IDTAs) or EU Standard Contractual Clauses (SCCs) as appropriate. Details of transfer
              safeguards are available on request at{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </section>

          <section id="deletion" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Deletion &amp; Return of Data</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Upon termination of your ByteSend account, or upon written request, we will delete or return
              all personal data we process on your behalf, and delete existing copies, unless retention is
              required by applicable law. You may export your contact and email data at any time via the
              platform. Deletion requests should be sent to{" "}
              <a href="mailto:legal@nodebyte.co.uk" className="text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid">
                legal@nodebyte.co.uk
              </a>
              .
            </p>
          </section>

          <section id="contact" className="scroll-mt-24 mb-10">
            <h2 className="text-lg font-semibold mb-3">Contact &amp; Signed Copies</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              For questions about this DPA, to request a countersigned copy, or to request information
              about our sub-processors and transfer safeguards, contact us at{" "}
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
