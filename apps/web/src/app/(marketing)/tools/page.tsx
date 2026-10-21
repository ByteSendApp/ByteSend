import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { TOOLS } from "~/components/marketing/tools/tool-page";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "Free email tools – ByteSend",
  description: "Free checkers for DMARC, SPF and DKIM. See how well your domain is protected and what to fix, no sign-up needed.",
  alternates: { canonical: "https://bytesend.cloud/tools" },
};

export default function ToolsPage() {
  if (!isCloud()) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Free tools</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Check your email setup</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          SPF, DKIM and DMARC decide whether your email is trusted. Check each one in seconds, with plain-language results. No sign-up needed.
        </p>
        <div className="mt-10 space-y-3">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <p className="flex items-center gap-1.5 text-base font-medium">
                {tool.name}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{tool.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
