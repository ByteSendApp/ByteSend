import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { Button } from "@bytesend/ui/src/button";
import { CallToAction } from "~/components/marketing/CallToAction";
import { Reveal } from "~/components/marketing/Reveal";
import { HairlineGrid, Section, SectionHeader } from "~/components/marketing/Section";
import { highlightCode } from "~/lib/highlighter";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "Open source email platform – ByteSend",
  description:
    "ByteSend is open source under the AGPL-3.0. Read every line, run it on your own servers with your own Amazon SES account, or use our cloud. Same code either way.",
  alternates: { canonical: "https://bytesend.cloud/open-source" },
};

const GITHUB = "https://github.com/ByteSendApp/ByteSend";
const SELF_HOSTING_DOCS = "https://docs.bytesend.cloud/self-hosting/overview";

const QUICK_START = `git clone https://github.com/ByteSendApp/ByteSend.git
cd ByteSend
cp docker/prod/.env.example docker/prod/.env
docker compose -f docker/prod/compose.yml --env-file docker/prod/.env up -d`;

const REASONS = [
  { title: "Read every line", text: "The sending pipeline, the dashboard, the API and the SDKs are all public. Nothing about how your email is handled is hidden." },
  { title: "No lock-in", text: "If you ever want to leave our cloud, run the same software yourself. Your integration only needs a new base URL." },
  { title: "Your data, your servers", text: "Self-hosted, your email, contacts and logs never leave your infrastructure, and you send through your own SES account." },
  { title: "Built in the open", text: "Issues, pull requests and the roadmap happen on GitHub, and every release is in the changelog." },
];

const COMPARE = [
  { label: "Where it runs", cloud: "Our infrastructure", self: "Your servers" },
  { label: "Sending", cloud: "Through our Amazon SES accounts", self: "Through your own Amazon SES account" },
  { label: "Cost", cloud: "Free up to 5,000 emails a month, then plans from $5", self: "Free software. You pay your hosting and AWS directly" },
  { label: "Updates", cloud: "Automatic", self: "Pull new images when you're ready" },
  { label: "Plan limits", cloud: "Per plan", self: "None" },
  { label: "Features", cloud: "Everything", self: "Everything" },
];

export default async function OpenSourcePage() {
  if (!isCloud()) notFound();

  const quickStart = await highlightCode(QUICK_START, {
    lang: "bash",
    themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" },
  }).catch(() => "");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Open source</p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Email infrastructure you can read, run and own</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              ByteSend is open source under the AGPL-3.0. Use our cloud, or run the same code on your own servers with your own Amazon SES
              account.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" className="h-11 px-6" asChild>
                <a href={GITHUB} target="_blank" rel="noopener noreferrer">
                  <FaGithub className="size-4" />
                  View on GitHub
                </a>
              </Button>
              <Button variant="outline" size="lg" className="h-11 px-6" asChild>
                <a href={SELF_HOSTING_DOCS} target="_blank" rel="noopener noreferrer">
                  Self-hosting guide
                </a>
              </Button>
            </div>
          </div>

          <Reveal className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border/70 bg-background/95 px-5 py-2.5 font-mono text-[11px] text-muted-foreground">Run it yourself</div>
            {quickStart ? (
              <div
                className="overflow-x-auto bg-background text-[13px] leading-[1.7] [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:px-5 [&_pre]:py-5"
                dangerouslySetInnerHTML={{ __html: quickStart }}
              />
            ) : (
              <pre className="overflow-x-auto bg-background px-5 py-5 text-[13px] leading-[1.7] text-foreground/85">
                <code>{QUICK_START}</code>
              </pre>
            )}
            <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
              Starts the app, PostgreSQL, Redis, storage and the SMTP relay. Fill in your SES credentials in <span className="font-mono">.env</span> first.
            </p>
          </Reveal>
        </div>
      </section>

      <Section bordered={false}>
        <SectionHeader eyebrow="Why open source" title="Trust you can verify" align="left" />
        <HairlineGrid className="grid-cols-1 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div key={reason.title} className="p-6">
              <h3 className="text-[15px] font-semibold">{reason.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{reason.text}</p>
            </div>
          ))}
        </HairlineGrid>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Cloud or self-hosted" title="Same software, your choice" align="left" />
        <Reveal className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="w-40 px-4 py-3 text-left text-xs font-medium text-muted-foreground" />
                <th className="bg-primary/[0.06] px-4 py-3 text-left text-xs font-semibold text-primary">ByteSend Cloud</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Self-hosted</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                  <td className="bg-primary/[0.06] px-4 py-3 text-foreground">{row.cloud}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.self}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/pricing" className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              Cloud pricing
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">No servers to run. Free to start, and you only pay for what you send.</p>
          </Link>
          <a href={`${GITHUB}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              The AGPL-3.0 licence
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Using ByteSend puts no obligations on your own code. If you change ByteSend and offer it as a service, you share those changes.
            </p>
          </a>
        </div>
      </Section>

      <CallToAction />
    </main>
  );
}
