"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import { cn } from "@bytesend/ui/lib/utils";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import {
  BOUNCE_RATE_HARD_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
} from "~/lib/constants/deliverability";
import { AdminPageHeader } from "./_components/admin-page-header";
import { StatCard, StatCardSkeleton } from "./_components/stat-card";
import { formatCompact, formatNumber, formatPercent, ratio } from "./_components/format";
import { DailyBarChart } from "./_overview/daily-bar-chart";
import { SesQuotaCard } from "./_overview/ses-quota-card";
import { AttentionCard } from "./_overview/attention-card";
import { RecentActivityCard } from "./_overview/recent-activity-card";
import { useColors } from "../dashboard/hooks/useColors";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function parseRange(value: string | null): Range {
  const parsed = Number(value);
  return RANGES.find((range) => range === parsed) ?? 30;
}

function RangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5" role="group" aria-label="Time range">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium tabular-nums transition-colors",
            value === range
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {range}d
        </button>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [rangeParam, setRangeParam] = useUrlState("range", "30");
  const days = parseRange(rangeParam);
  const colors = useColors();

  const overviewQuery = api.admin.getOverview.useQuery({ days }, { placeholderData: (prev) => prev });
  const overview = overviewQuery.data;

  const sendingSeries = useMemo(
    () => [
      { key: "delivered", label: "Delivered", color: colors.delivered },
      { key: "bounced", label: "Bounced", color: colors.bounced },
      { key: "complained", label: "Complained", color: colors.complained },
    ],
    [colors],
  );

  const signupSeries = useMemo(
    () => [
      { key: "newUsers", label: "Users", color: colors.clicked },
      { key: "newTeams", label: "Teams", color: colors.opened },
    ],
    [colors],
  );

  const current = overview?.usage.current;
  const previous = overview?.usage.previous;

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description={
          overview ? `${overview.periodStart} → ${overview.periodEnd} (UTC)` : "Platform activity across all teams"
        }
        actions={<RangePicker value={days} onChange={(range) => setRangeParam(String(range))} />}
      />

      {!overview || !current || !previous ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", overviewQuery.isFetching && "opacity-70")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Emails sent"
              value={formatCompact(current.sent)}
              current={current.sent}
              previous={previous.sent}
              trend={overview.series.map((day) => day.sent)}
            />
            <StatCard
              label="Delivery rate"
              value={formatPercent(ratio(current.delivered, current.sent), 1)}
              current={ratio(current.delivered, current.sent)}
              previous={ratio(previous.delivered, previous.sent)}
              hint={`${formatNumber(current.delivered)} delivered`}
            />
            <StatCard
              label="Hard bounce rate"
              value={formatPercent(ratio(current.hardBounced, current.delivered))}
              current={ratio(current.hardBounced, current.delivered)}
              previous={ratio(previous.hardBounced, previous.delivered)}
              lowerIsBetter
              hint={`Block threshold ${formatPercent(BOUNCE_RATE_HARD_LIMIT, 0)} per team`}
            />
            <StatCard
              label="Complaint rate"
              value={formatPercent(ratio(current.complained, current.delivered), 3)}
              current={ratio(current.complained, current.delivered)}
              previous={ratio(previous.complained, previous.delivered)}
              lowerIsBetter
              hint={`Block threshold ${formatPercent(COMPLAINT_RATE_HARD_LIMIT, 1)} per team`}
            />
            <StatCard
              label="New users"
              value={formatNumber(overview.signups.users.current)}
              current={overview.signups.users.current}
              previous={overview.signups.users.previous}
              trend={overview.series.map((day) => day.newUsers)}
              hint={`${formatNumber(overview.totals.users)} total`}
            />
            <StatCard
              label="New teams"
              value={formatNumber(overview.signups.teams.current)}
              current={overview.signups.teams.current}
              previous={overview.signups.teams.previous}
              trend={overview.series.map((day) => day.newTeams)}
              hint={`${formatNumber(overview.totals.teams)} total`}
            />
            <StatCard
              label="Paid teams"
              value={formatNumber(overview.totals.paidTeams)}
              hint={`${formatPercent(ratio(overview.totals.paidTeams, overview.totals.teams), 1)} of all teams`}
            />
            <StatCard
              label="Open rate"
              value={formatPercent(ratio(current.opened, current.delivered), 1)}
              current={ratio(current.opened, current.delivered)}
              previous={ratio(previous.opened, previous.delivered)}
              hint="Only teams with open tracking"
            />
          </div>

          <DailyBarChart
            title="Sending volume"
            description="Daily delivered, bounced and complained across all teams"
            data={overview.series}
            series={sendingSeries}
            height={280}
          />

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <DailyBarChart
              title="Signups"
              description="New users and teams per day"
              data={overview.series}
              series={signupSeries}
              stacked={false}
              height={220}
            />
            <SesQuotaCard />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <AttentionCard attention={overview.attention} />
            <RecentActivityCard />
          </div>
        </div>
      )}
    </>
  );
}
