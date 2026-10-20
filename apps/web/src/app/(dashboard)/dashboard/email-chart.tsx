import React from "react";
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Lock } from "lucide-react";
import { Panel } from "@bytesend/ui/src/panel";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Button } from "@bytesend/ui/src/button";
import { api } from "~/trpc/react";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { LimitReason } from "~/lib/constants/plans";
import { useColors } from "./hooks/useColors";

interface EmailChartProps {
  days: number;
  domain: string | null;
  isPaidTeam: boolean;
}

const STACK_ORDER = ["delivered", "bounced", "complained", "opened", "clicked"] as const;
type StackKey = (typeof STACK_ORDER)[number];

// Rates only mean something once there's enough mail behind them.
const MIN_VOLUME_FOR_TONE = 100;

function createRoundedTopShape(currentKey: StackKey, visibleStackOrder: StackKey[]) {
  const currentIndex = visibleStackOrder.indexOf(currentKey);
  return (props: any) => {
    const payload = props.payload as Partial<Record<StackKey, number>> | undefined;
    const hasAbove = visibleStackOrder.slice(currentIndex + 1).some((key) => (payload?.[key] ?? 0) > 0);
    return <Rectangle {...props} radius={(hasAbove ? [0, 0, 0, 0] : [3, 3, 0, 0]) as any} />;
  };
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function formatPercent(value: number): string {
  return `${value.toFixed(value > 0 && value < 1 ? 2 : 1)}%`;
}

export default function EmailChart({ days, domain, isPaidTeam }: EmailChartProps) {
  const [hidden, setHidden] = React.useState<StackKey[]>([]);
  const openUpgradeModal = useUpgradeModalStore((s) => s.action.openModal);
  const statusQuery = api.dashboard.emailTimeSeries.useQuery({ days, domain: domain ? Number(domain) : undefined });
  const colors = useColors();

  const meta: Record<StackKey, { label: string; color: string }> = {
    delivered: { label: "Delivered", color: colors.delivered },
    bounced: { label: "Bounced", color: colors.bounced },
    complained: { label: "Complained", color: colors.complained },
    opened: { label: "Opened", color: colors.opened },
    clicked: { label: "Clicked", color: colors.clicked },
  };
  const visible = STACK_ORDER.filter((key) => !hidden.includes(key));

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-18.5 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const { totalCounts, result } = statusQuery.data;
  const sent = totalCounts.sent ?? 0;
  const enough = sent >= MIN_VOLUME_FOR_TONE;
  const bounceRate = ratio(totalCounts.bounced, sent);
  const complaintRate = ratio(totalCounts.complained, sent);

  return (
    <div className="space-y-4">
      <StatGroup>
        <Stat
          label={`Sent · ${days} days`}
          value={sent.toLocaleString()}
          hint={`${Math.round(sent / Math.max(days, 1)).toLocaleString()} a day on average`}
          trend={result.map((day) => day.sent ?? 0)}
        />
        <Stat label="Delivered" value={formatPercent(ratio(totalCounts.delivered, sent))} hint={`${totalCounts.delivered.toLocaleString()} emails`} />
        <Stat
          label="Bounced"
          value={formatPercent(bounceRate)}
          hint={`${totalCounts.bounced.toLocaleString()} emails`}
          tone={!enough ? "default" : bounceRate >= 2 ? "danger" : bounceRate >= 1 ? "warning" : "default"}
        />
        <Stat
          label="Complaints"
          value={formatPercent(complaintRate)}
          hint={`${totalCounts.complained.toLocaleString()} emails`}
          tone={!enough ? "default" : complaintRate >= 0.1 ? "danger" : complaintRate >= 0.05 ? "warning" : "default"}
        />
        {isPaidTeam ? (
          <>
            <Stat label="Opened" value={formatPercent(ratio(totalCounts.opened, totalCounts.delivered))} hint="of delivered" />
            <Stat label="Clicked" value={formatPercent(ratio(totalCounts.clicked, totalCounts.delivered))} hint="of delivered" />
          </>
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal(LimitReason.MARKETING_NOT_AVAILABLE)}
            className="flex flex-col items-start justify-center gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" /> Opens and clicks
            </span>
            <span className="text-[13px] text-foreground">Available on paid plans</span>
          </button>
        )}
      </StatGroup>

      <Panel
        title="Activity"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1">
            {STACK_ORDER.map((key) => {
              const active = !hidden.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setHidden((prev) => (active ? [...prev, key] : prev.filter((k) => k !== key)))}
                  className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-muted ${
                    active ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: active ? meta[key].color : "currentColor" }} />
                  {meta[key].label}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="date"
                fontSize={11}
                stroke={colors.xaxis}
                tick={{ fill: colors.xaxis }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <Tooltip
                cursor={{ fill: colors.grid, opacity: 0.5 }}
                content={({ payload }) => {
                  const data = payload?.[0]?.payload as (Record<StackKey | "sent", number> & { date: string }) | undefined;
                  if (!data) return null;
                  return (
                    <div className="min-w-40 space-y-1.5 rounded-md border border-border bg-popover px-3 py-2 shadow-lg">
                      <p className="text-xs font-medium text-foreground">{data.date}</p>
                      {visible.map((key) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="size-2 rounded-[2px]" style={{ backgroundColor: meta[key].color }} />
                          <span className="flex-1 text-muted-foreground">{meta[key].label}</span>
                          <span className="tabular-nums text-foreground">{(data[key] ?? 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {visible.map((key) => (
                <Bar
                  key={key}
                  maxBarSize={22}
                  dataKey={key}
                  stackId="a"
                  fill={meta[key].color}
                  shape={createRoundedTopShape(key, visible)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!isPaidTeam ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Open and click rates, click-to-open and engagement trends come with any paid plan.</span>
            <Button size="sm" variant="outline" onClick={() => openUpgradeModal(LimitReason.MARKETING_NOT_AVAILABLE)}>
              See plans
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
