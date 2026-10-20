"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Globe } from "lucide-react";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";
import { EmailStatusBadge } from "../emails/email-status-badge";

type Overview = inferRouterOutputs<AppRouter>["dashboard"]["overview"];

const number = new Intl.NumberFormat("en-US");

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border/60 bg-card shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Meter({ value, max, tone }: { value: number; max: number; tone: "ok" | "warn" | "bad" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-amber-500" : "bg-primary";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }} />
    </div>
  );
}

const ONBOARDING_STEPS: Array<{ key: keyof Overview["onboarding"]; label: string; href: string }> = [
  { key: "domainAdded", label: "Add a sending domain", href: "/domains" },
  { key: "domainVerified", label: "Verify it with DNS records", href: "/domains" },
  { key: "apiKeyCreated", label: "Create an API key", href: "/settings/api-keys" },
  { key: "firstEmailSent", label: "Send your first email", href: "https://docs.bytesend.cloud/get-started/examples" },
  { key: "webhookAdded", label: "Get delivery events with a webhook", href: "/webhooks" },
];

function Onboarding({ steps }: { steps: Overview["onboarding"] }) {
  const done = ONBOARDING_STEPS.filter((step) => steps[step.key]).length;
  if (done === ONBOARDING_STEPS.length) return null;
  return (
    <Panel title="Get started" action={<span className="text-xs text-muted-foreground">{done} of {ONBOARDING_STEPS.length} done</span>}>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {ONBOARDING_STEPS.map((step) => {
          const complete = steps[step.key];
          const external = step.href.startsWith("http");
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`flex h-full items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  complete ? "border-border/40 text-muted-foreground" : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={complete ? "line-through decoration-muted-foreground/40" : ""}>{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function SendingStatus({ sending }: { sending: Overview["sending"] }) {
  const map: Record<Overview["sending"]["status"], { tone: "ok" | "warn" | "bad"; title: string; body: ReactNode }> = {
    active: { tone: "ok", title: "Sending normally", body: "All limits are clear." },
    new_team: {
      tone: "warn",
      title: "New-account limit",
      body:
        sending.status === "new_team" ? (
          <>
            New free accounts can send {sending.dailyLimit} emails a day until{" "}
            {format(new Date(sending.endsAt), "MMM d")}. <Link href="/settings/billing" className="underline">Upgrade</Link> to lift it now.
          </>
        ) : null,
    },
    blocked: {
      tone: "bad",
      title: "Sending is blocked",
      body: (
        <>
          Your team was blocked by ByteSend. <a href="https://discord.gg/C2Q4GHXKQA" className="underline">Contact support</a> to resolve it.
        </>
      ),
    },
    bounce_paused: {
      tone: "bad",
      title: "Paused: bounce rate too high",
      body: "Remove invalid addresses from your lists. Sending resumes once your 7-day bounce rate drops below 2%.",
    },
    complaint_paused: {
      tone: "bad",
      title: "Paused: too many spam complaints",
      body: "Only email people who asked to hear from you. Sending resumes once your 7-day complaint rate drops below 0.1%.",
    },
    daily_limit: {
      tone: "warn",
      title: "Daily limit reached",
      body: sending.status === "daily_limit" ? `Sending resumes ${formatDistanceToNow(new Date(sending.resetsAt), { addSuffix: true })}.` : null,
    },
    monthly_limit: {
      tone: "bad",
      title: "Monthly limit reached",
      body:
        sending.status === "monthly_limit" ? (
          <>
            Sending resumes {format(new Date(sending.resetsAt), "MMM d")}, or <Link href="/settings/billing" className="underline">upgrade</Link> to keep sending.
          </>
        ) : null,
    },
  };
  const look = map[sending.status];
  const dot = look.tone === "bad" ? "bg-destructive" : look.tone === "warn" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot}`} />
      <div>
        <p className="font-medium">{look.title}</p>
        <p className="text-sm text-muted-foreground">{look.body}</p>
      </div>
    </div>
  );
}

function Usage({ usage }: { usage: Overview["usage"] }) {
  const monthTone = (used: number, max: number | null) =>
    max === null ? "ok" : used >= max ? (usage.billsOverage ? "warn" : "bad") : used >= max * 0.8 ? "warn" : "ok";
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">This month</span>
          <span className="tabular-nums">
            {number.format(usage.thisMonth)}
            {usage.monthlyAllowance !== null ? <span className="text-muted-foreground"> / {number.format(usage.monthlyAllowance)}</span> : null}
          </span>
        </div>
        {usage.monthlyAllowance !== null ? (
          <Meter value={usage.thisMonth} max={usage.monthlyAllowance} tone={monthTone(usage.thisMonth, usage.monthlyAllowance)} />
        ) : null}
        {usage.billsOverage && usage.monthlyAllowance !== null && usage.thisMonth > usage.monthlyAllowance ? (
          <p className="text-xs text-muted-foreground">
            {number.format(usage.thisMonth - usage.monthlyAllowance)} emails over your plan, billed on your next invoice.
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Today</span>
          <span className="tabular-nums">
            {number.format(usage.today)}
            <span className="text-muted-foreground"> / {usage.dailyLimit === null ? "no daily limit" : number.format(usage.dailyLimit)}</span>
          </span>
        </div>
        {usage.dailyLimit !== null ? (
          <Meter value={usage.today} max={usage.dailyLimit} tone={monthTone(usage.today, usage.dailyLimit) === "bad" ? "warn" : monthTone(usage.today, usage.dailyLimit)} />
        ) : null}
      </div>
    </div>
  );
}

function RateRow({ label, rate, warn, limit }: { label: string; rate: number; warn: number; limit: number }) {
  const tone = rate >= limit ? "bad" : rate >= warn ? "warn" : "ok";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : ""}>{(rate * 100).toFixed(2)}%</span>
          <span className="text-muted-foreground"> / {(limit * 100).toFixed(limit < 0.01 ? 1 : 0)}% pause</span>
        </span>
      </div>
      <Meter value={rate} max={limit} tone={tone} />
    </div>
  );
}

function Deliverability({ d }: { d: Overview["deliverability"] }) {
  return (
    <div className="space-y-4">
      <RateRow label="Hard bounces" rate={d.bounceRate} warn={d.bounce.warn} limit={d.bounce.limit} />
      <RateRow label="Spam complaints" rate={d.complaintRate} warn={d.complaint.warn} limit={d.complaint.limit} />
      <p className="text-xs text-muted-foreground">
        Last {d.windowDays} days, {number.format(d.delivered)} delivered.
        {d.delivered < d.minVolume ? ` Sending is only paused once you've delivered ${d.minVolume}+ emails in that window.` : ""}
      </p>
    </div>
  );
}

function Domains({ domains }: { domains: Overview["domains"] }) {
  if (domains.length === 0) {
    return (
      <Link href="/domains" className="flex items-center gap-2 text-sm text-primary hover:underline">
        <Globe className="size-4" /> Add your first domain
      </Link>
    );
  }
  return (
    <ul className="space-y-2">
      {domains.slice(0, 6).map((domain) => {
        const problem = domain.dnsIssues.length > 0;
        const verified = domain.status === "SUCCESS";
        return (
          <li key={domain.id}>
            <Link href={`/domains/${domain.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
              <span className="min-w-0 truncate font-mono text-xs">{domain.name}</span>
              <span
                className={`flex shrink-0 items-center gap-1 text-xs ${
                  problem ? "text-destructive" : verified ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {problem ? <AlertTriangle className="size-3.5" /> : null}
                {problem ? "DNS problem" : verified ? "Verified" : domain.status === "FAILED" ? "Failed" : "Pending"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentEmails({ emails }: { emails: Overview["recentEmails"] }) {
  if (emails.length === 0) {
    return <p className="text-sm text-muted-foreground">No emails yet. Your first send will show up here.</p>;
  }
  return (
    <ul className="divide-y divide-border/50">
      {emails.map((email) => (
        <li key={email.id}>
          <Link href={`/emails?emailId=${email.id}`} className="flex items-center gap-3 py-2 text-sm hover:bg-muted/30">
            <div className="w-24 shrink-0">
              <EmailStatusBadge status={email.latestStatus} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate">{email.subject}</p>
              <p className="truncate text-xs text-muted-foreground">{email.to.join(", ")}</p>
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
              {formatDistanceToNow(email.createdAt, { addSuffix: true })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardOverview() {
  const query = api.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000 });

  if (query.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!query.data) return null;
  const data = query.data;

  return (
    <div className="space-y-4">
      <Onboarding steps={data.onboarding} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Sending"
          action={
            <Link href="/settings/usage" className="text-xs text-muted-foreground hover:text-foreground">
              Usage <ArrowRight className="inline size-3" />
            </Link>
          }
        >
          <div className="space-y-5">
            <SendingStatus sending={data.sending} />
            <Usage usage={data.usage} />
          </div>
        </Panel>
        <Panel title="Deliverability">
          <Deliverability d={data.deliverability} />
        </Panel>
        <Panel
          title="Domains"
          action={
            <Link href="/domains" className="text-xs text-muted-foreground hover:text-foreground">
              All <ArrowRight className="inline size-3" />
            </Link>
          }
        >
          <Domains domains={data.domains} />
        </Panel>
      </div>

      <Panel
        title="Recent emails"
        action={
          <Link href="/emails" className="text-xs text-muted-foreground hover:text-foreground">
            All emails <ArrowRight className="inline size-3" />
          </Link>
        }
      >
        <RecentEmails emails={data.recentEmails} />
      </Panel>
    </div>
  );
}
