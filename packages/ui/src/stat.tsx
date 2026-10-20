import * as React from "react";
import { cn } from "../lib/utils";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small text under the value, e.g. "of 100,000" or a threshold. */
  hint?: React.ReactNode;
  /** Change against the previous period, as a percentage. Positive is shown as good unless `invertDelta` is set. */
  delta?: number | null;
  invertDelta?: boolean;
  /** Draws a small trend line from these values. */
  trend?: number[];
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const TONE_TEXT = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
} as const;

export function Stat({ label, value, hint, delta, invertDelta, trend, tone = "default", className }: StatProps) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const good = showDelta && (invertDelta ? delta! <= 0 : delta! >= 0);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1 px-4 py-3", className)}>
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn("truncate text-xl font-semibold tabular-nums tracking-tight", TONE_TEXT[tone])}>{value}</span>
          {showDelta ? (
            <span className={cn("text-xs font-medium tabular-nums", good ? "text-success" : "text-destructive")}>
              {delta! > 0 ? "+" : ""}
              {delta!.toFixed(Math.abs(delta!) < 10 ? 1 : 0)}%
            </span>
          ) : null}
        </div>
        {trend && trend.length > 1 && trend.some((v) => v > 0) ? <Sparkline values={trend} /> : null}
      </div>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** A row of stats inside one bordered strip, divided like a table. */
export function StatGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // The 1px gaps over a border-coloured background draw the dividers between cells.
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:auto-cols-fr md:grid-flow-col md:grid-cols-none",
        "[&>*]:bg-card [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
      {...props}
    />
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 64;
  const height = 22;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - ((v - min) / span) * (height - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("shrink-0 text-primary", className)} aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
