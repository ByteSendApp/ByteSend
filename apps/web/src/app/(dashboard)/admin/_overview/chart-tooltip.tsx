import type { TooltipProps } from "recharts";

export type ChartSeries = { key: string; label: string; color: string };

export function ChartTooltip({
  active,
  payload,
  series,
}: TooltipProps<number, string> & { series: ChartSeries[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Record<string, number | string> | undefined;
  if (!row) return null;

  return (
    <div className="flex min-w-36 flex-col gap-1.5 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs text-muted-foreground">{row.date}</p>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
          <span className="flex-1 text-xs text-muted-foreground">{s.label}</span>
          <span className="font-mono text-xs tabular-nums">
            {Number(row[s.key] ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
