import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FaArrowRightLong } from "react-icons/fa6";
import { env } from "~/env";

export const metadata: Metadata = {
  title: "Legal – ByteSend",
  description: "Legal documents and policies for ByteSend, operated by NodeByte LTD.",
};

const policies = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal data in accordance with the UK GDPR and Data Protection Act 2018.",
    updated: "7 May 2026",
  },
  {
    href: "/terms",
    title: "Terms of Service",
    description: "The agreement governing your use of ByteSend, including billing, fair use, liability, and termination.",
    updated: "7 May 2026",
  },
  {
    href: "/acceptable-use",
    title: "Acceptable Use Policy",
    description: "Rules for sending email via ByteSend: consent, suppression, prohibited content, and enforcement.",
    updated: "7 May 2026",
  },
  {
    href: "/dpa",
    title: "Data Processing Agreement",
    description: "UK GDPR Article 28 DPA governing how NodeByte LTD processes personal data on your behalf as a data processor.",
    updated: "7 May 2026",
  },
  {
    href: "/cookie-policy",
    title: "Cookie Policy",
    description: "What cookies and similar technologies we use, why, and how you can control them.",
    updated: "7 May 2026",
  },
  {
    href: "/dmca",
    title: "DMCA & Copyright",
    description: "How to submit a copyright takedown notice, file a counter-notice, and our repeat infringer policy.",
    updated: "7 May 2026",
  },
];

const contacts = [
  { label: "General enquiries", email: "hey@nodebyte.co.uk" },
  { label: "Legal & privacy", email: "legal@nodebyte.co.uk" },
  { label: "Copyright / DMCA", email: "dmca@nodebyte.co.uk" },
];

export default function LegalPage() {
  if (!env.NEXT_PUBLIC_IS_CLOUD) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">NodeByte LTD</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Legal</h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl">
            All legal documents and policies for ByteSend. If you have questions or need a signed copy
            of any document, use the contact details below.
          </p>
        </div>

        <div className="grid gap-3 mb-14">
          {policies.map(({ href, title, description, updated }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-5 py-4 hover:border-border hover:bg-muted/40 transition-all"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">{title}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5 mt-0.5">
                <FaArrowRightLong className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" aria-hidden />
                <span className="text-[11px] text-muted-foreground/50">Updated {updated}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 px-5 py-5">
          <p className="text-sm font-medium mb-4">Contact us</p>
          <div className="divide-y divide-border/40">
            {contacts.map(({ label, email }) => (
              <div key={email} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-[13px] text-muted-foreground">{label}</span>
                <a
                  href={`mailto:${email}`}
                  className="text-[13px] text-foreground underline underline-offset-4 decoration-dotted hover:decoration-solid transition-all"
                >
                  {email}
                </a>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/50 text-center">
          NodeByte LTD · Registered in England and Wales
        </p>
      </div>
    </main>
  );
}
