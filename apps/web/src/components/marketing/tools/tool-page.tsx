import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const TOOLS = [
  { href: "/tools/dmarc", name: "DMARC checker", text: "Is your domain protected from spoofing, and are reports being collected?" },
  { href: "/tools/spf", name: "SPF checker", text: "Which servers may send as your domain, and is the record within its lookup limit?" },
  { href: "/tools/dkim", name: "DKIM checker", text: "Find your DKIM keys, check their strength, and spot broken or test-mode keys." },
];

export function ToolPage({
  current,
  title,
  intro,
  checker,
  explainer,
  faq,
}: {
  current: string;
  title: string;
  intro: string;
  checker: React.ReactNode;
  explainer?: { title: string; description?: string; items: Array<{ label: string; title: string; text: string }> };
  faq: Array<{ q: string; a: string }>;
}) {
  const others = TOOLS.filter((tool) => tool.href !== current);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <Link href="/tools" className="mb-3 inline-block font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary hover:underline">
            Free tool
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{intro}</p>
          <div className="mt-8">{checker}</div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-16 px-4 py-16 sm:px-6">
        {explainer ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">{explainer.title}</h2>
            {explainer.description ? <p className="mt-1 text-sm text-muted-foreground">{explainer.description}</p> : null}
            <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
              {explainer.items.map((item) => (
                <div key={item.label} className="bg-background p-5">
                  <p className="font-mono text-xs text-primary">{item.label}</p>
                  <p className="mt-2 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
          <dl className="mt-4 divide-y divide-border/70">
            {faq.map((item) => (
              <div key={item.q} className="py-4">
                <dt className="text-sm font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">More free tools</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {others.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {tool.name}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{tool.text}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
