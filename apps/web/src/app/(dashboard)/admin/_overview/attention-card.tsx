import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
} from "~/lib/constants/deliverability";
import { RateGauge } from "../_components/rate-gauge";
import { StatusPill } from "../_components/status-pill";

type Attention = inferRouterOutputs<AppRouter>["admin"]["getOverview"]["attention"];

function Section({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h4>
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          {emptyLabel}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border">{children}</ul>
      )}
    </section>
  );
}

export function AttentionCard({ attention }: { attention: Attention }) {
  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Needs attention</h3>
        <p className="text-xs text-muted-foreground">
          Teams over 7-day warning thresholds, blocked teams, and failing domains
        </p>
      </div>

      <Section
        title="Deliverability risk"
        count={attention.atRiskTeams.length}
        emptyLabel="No team is over a warning threshold"
      >
        {attention.atRiskTeams.map((team) => (
          <li key={team.teamId} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{team.name}</span>
              <span className="font-mono text-xs text-muted-foreground">#{team.teamId}</span>
              {team.isBlocked ? <StatusPill tone="destructive">Blocked</StatusPill> : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-16">Bounce</span>
              <RateGauge value={team.bounceRate} warn={BOUNCE_RATE_WARN_LIMIT} hard={BOUNCE_RATE_HARD_LIMIT} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-16">Complaint</span>
              <RateGauge
                value={team.complaintRate}
                warn={COMPLAINT_RATE_WARN_LIMIT}
                hard={COMPLAINT_RATE_HARD_LIMIT}
                fractionDigits={3}
              />
            </div>
          </li>
        ))}
      </Section>

      <Section title="Blocked teams" count={attention.blockedTeamCount} emptyLabel="No blocked teams">
        {attention.blockedTeams.map((team) => (
          <li key={team.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-foreground">{team.name}</span>
              <span className="font-mono text-xs text-muted-foreground">#{team.id}</span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{team.plan}</span>
          </li>
        ))}
      </Section>

      <Section title="Failing domains" count={attention.failingDomainCount} emptyLabel="All domains are healthy">
        {attention.failingDomains.map((domain) => (
          <li key={domain.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-foreground">{domain.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {domain.team.name} · updated {formatDistanceToNow(domain.updatedAt, { addSuffix: true })}
              </p>
            </div>
            <StatusPill tone={domain.status === "FAILED" ? "destructive" : "warning"}>
              {domain.status === "FAILED" ? "Failed" : "Temporary failure"}
            </StatusPill>
          </li>
        ))}
      </Section>
    </div>
  );
}
