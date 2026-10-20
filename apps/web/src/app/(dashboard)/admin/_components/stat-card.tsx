import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { cn } from "@bytesend/ui/lib/utils";
import { relativeChange } from "./format";

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(2)},${(30 - (v / max) * 28).toFixed(2)}`);

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  current,
  previous,
  lowerIsBetter = false,
  hint,
  trend,
}: {
  label: string;
  value: ReactNode;
  current?: number;
  previous?: number;
  lowerIsBetter?: boolean;
  hint?: ReactNode;
  trend?: number[];
}) {
  const change =
    current !== undefined && previous !== undefined ? relativeChange(current, previous) : undefined;
  const isUp = change !== undefined && change !== null && change > 0;
  const isFlat = change === 0;
  const isGood = lowerIsBetter ? !isUp : isUp;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {change === undefined ? null : change === null ? (
          <span className="text-xs text-muted-foreground">new</span>
        ) : isFlat ? (
          <span className="text-xs text-muted-foreground">0%</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              isGood ? "text-success" : "text-destructive",
            )}
          >
            {isUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%
          </span>
        )}
      </div>
      {trend ? <Sparkline values={trend} className="text-muted-foreground/70" /> : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
