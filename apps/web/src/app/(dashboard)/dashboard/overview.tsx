"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, Circle, Globe, Mail } from "lucide-react";
import { Panel } from "@bytesend/ui/src/panel";
import { Callout } from "@bytesend/ui/src/callout";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";
import { EmailStatusBadge } from "../emails/email-status-badge";

type Overview = inferRouterOutputs<AppRouter>["dashboard"]["overview"];
type Tone = "ok" | "warn" | "bad";

const number = new Intl.NumberFormat("en-US");

function useOverview() {
  return api.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000 });
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
      {children}
      <ArrowRight className="size-3" />
    </Link>
  );
}

function Meter({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-primary";
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }} />
    </div>
  );
}

/* ---------- needs attention ---------- */

function sendingCallout(sending: Overview["sending"]): ReactNode {
  switch (sending.status) {
    case "active":
      return null;
    case "new_team":
      return (
        <Callout
          tone="info"
          title={`New accounts can send ${sending.dailyLimit} emails a day until ${format(new Date(sending.endsAt), "MMM d")}`}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Lift the limit</Link>
            </Button>
          }
        >
          It keeps spammers off the shared sending reputation. Any paid plan lifts it straight away.
        </Callout>
      );
    case "blocked":
      return (
        <Callout tone="danger" title="Sending is blocked for this team">
          ByteSend blocked sending from your team. <a href="https://discord.gg/C2Q4GHXKQA">Contact support</a> to sort it out.
        </Callout>
      );
    case "bounce_paused":
      return (
        <Callout tone="danger" title="Sending is paused: too many bounces">
          Remove invalid addresses from your lists. Sending resumes once your 7-day bounce rate is under 2%.
        </Callout>
      );
    case "complaint_paused":
      return (
        <Callout tone="danger" title="Sending is paused: too many spam complaints">
          Only email people who asked to hear from you. Sending resumes once your 7-day complaint rate is under 0.1%.
        </Callout>
      );
    case "daily_limit":
      return (
        <Callout tone="warning" title="You've hit today's limit">
          Sending resumes {formatDistanceToNow(new Date(sending.resetsAt), { addSuffix: true })}.
        </Callout>
      );
    case "monthly_limit":
      return (
        <Callout
          tone="danger"
          title="You've used this month's emails"
          action={
            <Button asChild size="sm">
              <Link href="/settings/billing">Upgrade</Link>
            </Button>
          }
        >
          Sending resumes {format(new Date(sending.resetsAt), "MMM d")}, or upgrade to keep sending now.
        </Callout>
      );
  }
}

export function OverviewAttention() {
  const { data } = useOverview();
  if (!data) return null;

  const callouts: ReactNode[] = [];
  const sending = sendingCallout(data.sending);
  if (sending) callouts.push(<div key="sending">{sending}</div>);

  for (const domain of data.domains.filter((d) => d.dnsIssues.length > 0).slice(0, 2)) {
    callouts.push(
      <Callout
        key={`dns-${domain.id}`}
        tone="danger"
        title={`${domain.name}: DNS records changed`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/domains/${domain.id}`}>Fix records</Link>
          </Button>
        }
      >
        {domain.dnsIssues[0]}
        {domain.dnsIssues.length > 1 ? ` (and ${domain.dnsIssues.length - 1} more)` : ""}
      </Callout>,
    );
  }

  const failed = data.domains.find((d) => d.status === "FAILED" && d.dnsIssues.length === 0);
  if (failed) {
    callouts.push(
      <Callout
        key="failed"
        tone="warning"
        title={`${failed.name} isn't verified`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/domains/${failed.id}`}>Check DNS</Link>
          </Button>
        }
      >
        We couldn&apos;t find its DNS records. You can&apos;t send from it until they&apos;re in place.
      </Callout>,
    );
  }

  const d = data.deliverability;
  if (d.delivered >= d.minVolume && sending === null) {
    if (d.bounceRate >= d.bounce.warn) {
      callouts.push(
        <Callout key="bounce" tone="warning" title={`Your bounce rate is ${(d.bounceRate * 100).toFixed(2)}%`}>
          Sending pauses at {(d.bounce.limit * 100).toFixed(0)}%. Check for old or bought lists and remove addresses that bounce.
        </Callout>,
      );
    }
    if (d.complaintRate >= d.complaint.warn) {
      callouts.push(
        <Callout key="complaint" tone="warning" title={`Your complaint rate is ${(d.complaintRate * 100).toFixed(2)}%`}>
          Sending pauses at {(d.complaint.limit * 100).toFixed(1)}%. Make unsubscribing easy and only email people who signed up.
        </Callout>,
      );
    }
  }

  if (callouts.length === 0) return null;
  return <div className="space-y-2">{callouts}</div>;
}

/* ---------- setup ---------- */

const SETUP_STEPS: Array<{ key: keyof Overview["onboarding"]; label: string; href: string; cta: string }> = [
  { key: "domainAdded", label: "Add a sending domain", href: "/domains?add=1", cta: "Add domain" },
  { key: "domainVerified", label: "Verify it with DNS records", href: "/domains", cta: "Verify" },
  { key: "apiKeyCreated", label: "Create an API key", href: "/settings/api-keys", cta: "Create key" },
  { key: "firstEmailSent", label: "Send your first email", href: "https://docs.bytesend.cloud/get-started/examples", cta: "See examples" },
  { key: "webhookAdded", label: "Get delivery events with a webhook", href: "/webhooks", cta: "Add webhook" },
];

export function SetupProgress() {
  const { data } = useOverview();
  if (!data) return null;
  const done = SETUP_STEPS.filter((step) => data.onboarding[step.key]).length;
  if (done === SETUP_STEPS.length) return null;
  const next = SETUP_STEPS.find((step) => !data.onboarding[step.key])!;
  const external = next.href.startsWith("http");

  return (
    <Panel
      title="Finish setting up"
      description={`${done} of ${SETUP_STEPS.length} done`}
      actions={
        <Button asChild size="sm">
          <Link href={next.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {next.cta}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / SETUP_STEPS.length) * 100}%` }} />
      </div>
      <ol className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-5">
        {SETUP_STEPS.map((step) => {
          const complete = data.onboarding[step.key];
          const isNext = step.key === next.key;
          return (
            <li key={step.key} className={`flex items-start gap-2 ${complete ? "text-muted-foreground" : isNext ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {complete ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : (
                <Circle className={`mt-0.5 size-3.5 shrink-0 ${isNext ? "text-primary" : ""}`} />
              )}
              {step.label}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ---------- panels ---------- */

function UsagePanel({ usage }: { usage: Overview["usage"] }) {
  const tone = (used: number, max: number | null): Tone =>
    max === null ? "ok" : used >= max ? (usage.billsOverage ? "warn" : "bad") : used >= max * 0.8 ? "warn" : "ok";
  const over = usage.monthlyAllowance !== null ? usage.thisMonth - usage.monthlyAllowance : 0;

  return (
    <Panel title="Usage" actions={<PanelLink href="/settings/usage">Details</PanelLink>}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="text-muted-foreground">This month</span>
            <span className="tabular-nums">
              {number.format(usage.thisMonth)}
              {usage.monthlyAllowance !== null ? <span className="text-muted-foreground"> of {number.format(usage.monthlyAllowance)}</span> : null}
            </span>
          </div>
          {usage.monthlyAllowance !== null ? <Meter value={usage.thisMonth} max={usage.monthlyAllowance} tone={tone(usage.thisMonth, usage.monthlyAllowance)} /> : null}
          {usage.billsOverage && over > 0 ? (
            <p className="text-xs text-muted-foreground">{number.format(over)} over your plan, added to your next invoice.</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="text-muted-foreground">Today</span>
            <span className="tabular-nums">
              {number.format(usage.today)}
              <span className="text-muted-foreground">{usage.dailyLimit === null ? " · no daily limit" : ` of ${number.format(usage.dailyLimit)}`}</span>
            </span>
          </div>
          {usage.dailyLimit !== null ? <Meter value={usage.today} max={usage.dailyLimit} tone={tone(usage.today, usage.dailyLimit) === "bad" ? "warn" : tone(usage.today, usage.dailyLimit)} /> : null}
        </div>
      </div>
    </Panel>
  );
}

function RateRow({ label, rate, warn, limit, measured }: { label: string; rate: number; warn: number; limit: number; measured: boolean }) {
  // Below the minimum volume a few bounces swing the rate wildly, so it isn't shown as a problem.
  const tone: Tone = !measured ? "ok" : rate >= limit ? "bad" : rate >= warn ? "warn" : "ok";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : ""}>{(rate * 100).toFixed(2)}%</span>
          <span className="text-muted-foreground"> · pauses at {(limit * 100).toFixed(limit < 0.01 ? 1 : 0)}%</span>
        </span>
      </div>
      <Meter value={measured ? rate : 0} max={limit} tone={tone} />
    </div>
  );
}

function DeliverabilityPanel({ d }: { d: Overview["deliverability"] }) {
  const measured = d.delivered >= d.minVolume;
  return (
    <Panel title="Deliverability" description={`Last ${d.windowDays} days`}>
      <div className="space-y-4">
        <RateRow label="Hard bounces" rate={d.bounceRate} warn={d.bounce.warn} limit={d.bounce.limit} measured={measured} />
        <RateRow label="Spam complaints" rate={d.complaintRate} warn={d.complaint.warn} limit={d.complaint.limit} measured={measured} />
        {!measured ? (
          <p className="text-xs text-muted-foreground">
            {number.format(d.delivered)} of {d.minVolume} delivered. Rates count once you&apos;ve sent {d.minVolume}+ emails in {d.windowDays} days.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function DomainsPanel({ domains }: { domains: Overview["domains"] }) {
  return (
    <Panel flush title="Domains" actions={domains.length ? <PanelLink href="/domains">All</PanelLink> : null}>
      {domains.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<Globe />}
          title="No domains yet"
          action={
            <Button asChild size="sm">
              <Link href="/domains?add=1">Add a domain</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {domains.slice(0, 6).map((domain) => {
            const problem = domain.dnsIssues.length > 0;
            const verified = domain.status === "SUCCESS";
            const label = problem ? "DNS problem" : verified ? "Verified" : domain.status === "FAILED" ? "Failed" : "Pending";
            const dot = problem || domain.status === "FAILED" ? "bg-destructive" : verified ? "bg-success" : "bg-warning";
            return (
              <li key={domain.id}>
                <Link href={`/domains/${domain.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] transition-colors hover:bg-muted/40">
                  <span className="min-w-0 truncate">{domain.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RecentEmailsPanel({ emails }: { emails: Overview["recentEmails"] }) {
  return (
    <Panel flush title="Recent emails" actions={emails.length ? <PanelLink href="/emails">All emails</PanelLink> : null}>
      {emails.length === 0 ? (
        <EmptyState className="py-10" icon={<Mail />} title="No emails yet" description="Your first send will show up here." />
      ) : (
        <ul className="divide-y divide-border/70">
          {emails.map((email) => (
            <li key={email.id}>
              <Link href={`/emails?emailId=${email.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40">
                <div className="w-24 shrink-0">
                  <EmailStatusBadge status={email.latestStatus} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{email.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{email.to.join(", ")}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatDistanceToNow(email.createdAt, { addSuffix: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OverviewPanels() {
  const query = useOverview();

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!query.data) return null;
  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UsagePanel usage={data.usage} />
        <DeliverabilityPanel d={data.deliverability} />
        <DomainsPanel domains={data.domains} />
      </div>
      <RecentEmailsPanel emails={data.recentEmails} />
    </div>
  );
}
