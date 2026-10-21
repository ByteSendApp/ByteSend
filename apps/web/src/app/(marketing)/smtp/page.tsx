import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { CallToAction } from "~/components/marketing/CallToAction";
import { Reveal } from "~/components/marketing/Reveal";
import { HairlineGrid, Section, SectionHeader } from "~/components/marketing/Section";
import { highlightCode, type HighlightLang } from "~/lib/highlighter";
import { isCloud } from "~/utils/common";

export const metadata: Metadata = {
  title: "SMTP relay service – ByteSend",
  description:
    "Send email from any app that speaks SMTP: WordPress, Laravel, Django, Rails, Node and more. Change one setting, keep your code, and get delivery tracking and analytics.",
  alternates: { canonical: "https://bytesend.cloud/smtp" },
};

const SETTINGS = [
  { label: "Host", value: "smtp.bytesend.cloud" },
  { label: "Port (STARTTLS)", value: "587 or 2587" },
  { label: "Port (TLS)", value: "465 or 2465" },
  { label: "Username", value: "Your SMTP username, from Settings → SMTP" },
  { label: "Password", value: "An API key" },
];

const SNIPPETS: Array<{ name: string; file: string; lang: HighlightLang; code: string }> = [
  {
    name: "Node.js",
    file: "mailer.ts",
    lang: "ts",
    code: `import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: "smtp.bytesend.cloud",
  port: 587,
  auth: { user: process.env.BYTESEND_SMTP_USER, pass: process.env.BYTESEND_API_KEY },
});

await transport.sendMail({
  from: "hello@yourapp.com",
  to: "jane@example.com",
  subject: "Welcome",
  html: "<p>Thanks for signing up!</p>",
});`,
  },
  {
    name: "Laravel",
    file: ".env",
    lang: "bash",
    code: `MAIL_MAILER=smtp
MAIL_HOST=smtp.bytesend.cloud
MAIL_PORT=587
MAIL_USERNAME=your-smtp-username
MAIL_PASSWORD=bs_••••••••
MAIL_FROM_ADDRESS=hello@yourapp.com`,
  },
  {
    name: "Django",
    file: "settings.py",
    lang: "python",
    code: `import os

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.bytesend.cloud"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ["BYTESEND_SMTP_USER"]
EMAIL_HOST_PASSWORD = os.environ["BYTESEND_API_KEY"]`,
  },
  {
    name: "Rails",
    file: "config/environments/production.rb",
    lang: "ruby",
    code: `config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address: "smtp.bytesend.cloud",
  port: 587,
  user_name: ENV["BYTESEND_SMTP_USER"],
  password: ENV["BYTESEND_API_KEY"],
  enable_starttls_auto: true,
}`,
  },
];

const WHY = [
  { title: "No code changes", text: "Anything that can send email over SMTP works, including apps and plugins you can't edit." },
  { title: "Every email tracked", text: "Mail sent over SMTP shows up in your dashboard with its delivery status, just like the API." },
  { title: "Bounces handled for you", text: "Hard bounces and spam complaints are suppressed automatically, protecting your sender reputation." },
  { title: "Your domain, signed", text: "DKIM, SPF and DMARC for your domain, so mail lands in the inbox instead of spam." },
  { title: "Webhooks too", text: "Get delivered, bounced, opened and clicked events for SMTP mail, signed and retried." },
  { title: "Same price as the API", text: "SMTP email counts toward your plan like any other. 5,000 a month free." },
];

export default async function SmtpPage() {
  if (!isCloud()) notFound();

  const highlighted = await Promise.all(
    SNIPPETS.map((snippet) =>
      highlightCode(snippet.code, { lang: snippet.lang, themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" } }).catch(() => ""),
    ),
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">SMTP relay</p>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Change one setting, keep your code</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Point any app that sends email over SMTP at ByteSend: WordPress, Laravel, Django, Rails, Node, or software you can&apos;t change.
              You get delivery tracking, bounce handling and analytics without touching your code.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" className="h-11 px-6" asChild>
                <Link href="/signup">
                  Get your SMTP details
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-11 px-6" asChild>
                <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer">
                  Read the docs
                </a>
              </Button>
            </div>
          </div>

          <Reveal className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Connection settings</div>
            <dl className="divide-y divide-border/70">
              {SETTINGS.map((setting) => (
                <div key={setting.label} className="flex items-start justify-between gap-4 px-5 py-3 text-[13px]">
                  <dt className="shrink-0 text-muted-foreground">{setting.label}</dt>
                  <dd className="min-w-0 text-right font-mono text-xs text-foreground [overflow-wrap:anywhere]">{setting.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <Section bordered={false}>
        <SectionHeader eyebrow="Setup" title="Copy, paste, send" description="Use your SMTP username and an API key from the dashboard." align="left" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SNIPPETS.map((snippet, index) => (
            <Reveal key={snippet.name} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-5 py-2.5">
                <span className="text-xs font-medium">{snippet.name}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{snippet.file}</span>
              </div>
              {highlighted[index] ? (
                <div
                  className="overflow-x-auto bg-background text-[13px] leading-[1.7] [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:px-5 [&_pre]:py-5"
                  dangerouslySetInnerHTML={{ __html: highlighted[index]! }}
                />
              ) : (
                <pre className="overflow-x-auto bg-background px-5 py-5 text-[13px] leading-[1.7] text-foreground/85">
                  <code>{snippet.code}</code>
                </pre>
              )}
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">WordPress:</span> install an SMTP plugin such as WP Mail SMTP, choose &quot;Other SMTP&quot;, and
          enter the settings above with TLS on port 587.
        </p>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Why ByteSend" title="More than a relay" align="left" />
        <HairlineGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((item) => (
            <div key={item.title} className="p-6">
              <h3 className="text-[15px] font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </HairlineGrid>
      </Section>

      <CallToAction />
    </main>
  );
}
