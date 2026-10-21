import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AtSign, FileText, Forward, Inbox, MessageSquareReply, ShieldCheck, Webhook } from "lucide-react";
import { PLANS, type PlanType } from "@bytesend/lib";
import { Button } from "@bytesend/ui/src/button";
import { CallToAction } from "~/components/marketing/CallToAction";
import { Reveal } from "~/components/marketing/Reveal";
import { HairlineGrid, Section, SectionHeader } from "~/components/marketing/Section";
import { highlightCode, type HighlightLang } from "~/lib/highlighter";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "Receive email in your app – ByteSend",
  description:
    "Receive email on a hosted address or your own domain, and get every message as a webhook, through the API, in an inbox, or forwarded on.",
  alternates: { canonical: "https://bytesend.cloud/receiving" },
};

const DOCS = "https://docs.bytesend.cloud/guides/inbound-email";
const PLAN_ORDER: PlanType[] = ["FREE", "HOBBY", "BASIC", "SCALE"];
const number = new Intl.NumberFormat("en-US");

const STEPS = [
  {
    icon: AtSign,
    title: "Pick an address",
    text: "Use your team's hosted address straight away, or receive on a subdomain of your own domain like reply.yourapp.com with one MX record.",
  },
  {
    icon: ShieldCheck,
    title: "Mail arrives",
    text: "We receive it, scan it for spam and viruses, check SPF, DKIM and DMARC, and split out the text, HTML and attachments.",
  },
  {
    icon: Webhook,
    title: "You get it",
    text: "As an email.received webhook, through the API, in the dashboard inbox, or forwarded to any mailbox. Use one or all four.",
  },
];

const USE_CASES: Array<{
  icon: typeof Inbox;
  title: string;
  text: string;
  file: string;
  lang: HighlightLang;
  code: string;
}> = [
  {
    icon: MessageSquareReply,
    title: "Reply by email",
    text: "Let people answer a notification straight from their inbox. Replies to email you sent through ByteSend come with the original email's ID, so you know exactly which thread they belong to. The SDK checks the signature and types the event for you.",
    file: "app/api/inbound/route.ts",
    lang: "ts",
    code: `import { ByteSend } from "bytesend-js";

const webhooks = new ByteSend().webhooks(process.env.BYTESEND_WEBHOOK_SECRET!);

export async function POST(req: Request) {
  const event = webhooks.constructEvent(await req.text(), { headers: req.headers });

  if (event.type === "email.received" && event.data.inReplyToEmailId) {
    const { inReplyToEmailId, from, text } = event.data;
    await comments.create({ thread: inReplyToEmailId, author: from, body: text });
  }
  return new Response("ok");
}`,
  },
  {
    icon: FileText,
    title: "Parse invoices and receipts",
    text: "Give each customer an address like acme+invoices@ and pull the PDFs out of everything that arrives. Every attachment comes with a signed download link.",
    file: "import-invoices.ts",
    lang: "ts",
    code: `const { from, attachments } = event.data;

for (const file of attachments) {
  if (file.contentType !== "application/pdf") continue;
  const pdf = await fetch(file.url).then((res) => res.arrayBuffer());
  await invoices.import({ vendor: from, pdf });
}`,
  },
  {
    icon: Inbox,
    title: "A support inbox",
    text: "Point support@ at a receiving subdomain, read everything in the dashboard inbox, and forward a copy to your helpdesk. Replies go back to the customer, not to us.",
    file: "Forwarding rule",
    lang: "bash",
    code: `support@reply.yourapp.com  →  team@yourapp.com`,
  },
  {
    icon: Forward,
    title: "Process mail on your schedule",
    text: "No public endpoint? Fetch received mail from the API whenever it suits you, filtered by address or time.",
    file: "terminal",
    lang: "bash",
    code: `curl "https://bytesend.cloud/api/v1/inbound/emails?recipient=support@reply.yourapp.com" \\
  -H "Authorization: Bearer bs_••••••••"`,
  },
];

const DETAILS = [
  { title: "+tags on every address", text: "acme+orders@ and acme+invoices@ both arrive, so you can tell senders apart without new addresses." },
  { title: "Authentication results", text: "Every message shows whether SPF, DKIM and DMARC passed, plus spam and virus verdicts." },
  { title: "Signed webhooks", text: "Each delivery is signed and retried until your endpoint accepts it." },
  { title: "Kept for 30 days", text: "Messages and attachments stay in your inbox and API for 30 days, then they're deleted." },
  { title: "DMARC reports included", text: "Point your DMARC record at ByteSend and we read the reports for you. They don't count toward your allowance." },
  { title: "Open source", text: "Receiving is part of the AGPL codebase, so you can run it on your own AWS account too." },
];

export default async function ReceivingPage() {
  if (!isCloud()) notFound();

  const samples = await Promise.all(
    USE_CASES.map((useCase) =>
      highlightCode(useCase.code, {
        lang: useCase.lang,
        themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" },
      }).catch(() => ""),
    ),
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Receiving</p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Receive email in your app</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              ByteSend doesn&apos;t just send. Give your app an address, and every message that arrives reaches you as a webhook, through the API,
              in an inbox, or forwarded on.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" className="h-11 px-6" asChild>
                <Link href="/signup">
                  Start receiving free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-11 px-6" asChild>
                <a href={DOCS} target="_blank" rel="noopener noreferrer">
                  Read the guide
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {number.format(PLANS.FREE.limits.inboundEmailsPerMonth)} received emails a month free · No credit card
            </p>
          </div>
        </div>
      </section>

      <Section bordered={false}>
        <SectionHeader eyebrow="How it works" title="From inbox to your app in seconds" align="left" />
        <HairlineGrid className="grid-cols-1 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 60} className="p-6">
              <step.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </Reveal>
          ))}
        </HairlineGrid>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Use cases" title="What people build with it" align="left" />
        <div className="space-y-10">
          {USE_CASES.map((useCase, index) => (
            <Reveal key={useCase.title} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
              <div>
                <useCase.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{useCase.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{useCase.text}</p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border/70 bg-background/95 px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{useCase.file}</div>
                {samples[index] ? (
                  <div
                    className="overflow-x-auto bg-background text-[13px] leading-[1.7] [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:px-5 [&_pre]:py-5"
                    dangerouslySetInnerHTML={{ __html: samples[index]! }}
                  />
                ) : (
                  <pre className="overflow-x-auto bg-background px-5 py-5 text-[13px] leading-[1.7] text-foreground/85">
                    <code>{useCase.code}</code>
                  </pre>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="The details" title="Everything you'd want from an inbox API" align="left" />
        <HairlineGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {DETAILS.map((detail) => (
            <div key={detail.title} className="p-6">
              <h3 className="text-[15px] font-semibold">{detail.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail.text}</p>
            </div>
          ))}
        </HairlineGrid>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Pricing" title="Included on every plan" description="Received email has its own monthly allowance, separate from sending." align="left" />
        <HairlineGrid className="grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="p-6">
              <p className="text-sm text-muted-foreground">{PLANS[plan].displayName}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{number.format(PLANS[plan].limits.inboundEmailsPerMonth)}</p>
              <p className="mt-1 text-xs text-muted-foreground">received emails a month</p>
            </div>
          ))}
        </HairlineGrid>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/#pricing" className="text-primary hover:underline">
            See full pricing
          </Link>
        </p>
      </Section>

      <CallToAction />
    </main>
  );
}
