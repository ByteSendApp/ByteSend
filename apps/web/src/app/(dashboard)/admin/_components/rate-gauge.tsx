import { cn } from "@bytesend/ui/lib/utils";
import { formatPercent } from "./format";

export function rateTone(value: number, warn: number, hard: number) {
  if (value >= hard) return "destructive" as const;
  if (value >= warn) return "warning" as const;
  return "success" as const;
}

const barTone = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

// The track spans 0 → 1.5× the hard limit so the hard-limit marker sits at a fixed, visible spot.
export function RateGauge({
  value,
  warn,
  hard,
  fractionDigits = 2,
  className,
}: {
  value: number;
  warn: number;
  hard: number;
  fractionDigits?: number;
  className?: string;
}) {
  const scaleMax = hard * 1.5;
  const fill = Math.min(value / scaleMax, 1) * 100;
  const tone = rateTone(value, warn, hard);

  return (
    <div className={cn("flex min-w-32 items-center gap-2", className)}>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        aria-label={`${formatPercent(value, fractionDigits)} of ${formatPercent(hard, fractionDigits)} limit`}
      >
        <div className={cn("h-full rounded-full", barTone[tone])} style={{ width: `${fill}%` }} />
        <div
          className="absolute inset-y-0 w-px bg-warning/70"
          style={{ left: `${(warn / scaleMax) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-destructive/80"
          style={{ left: `${(hard / scaleMax) * 100}%` }}
        />
      </div>
      <span className="w-14 text-right font-mono text-xs tabular-nums text-foreground">
        {formatPercent(value, fractionDigits)}
      </span>
    </div>
  );
}
