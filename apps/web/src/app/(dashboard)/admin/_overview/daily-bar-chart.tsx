"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColors } from "../../dashboard/hooks/useColors";
import { formatCompact } from "../_components/format";
import { ChartLegend, ChartTooltip, type ChartSeries } from "./chart-tooltip";

export function DailyBarChart({
  title,
  description,
  data,
  series,
  stacked = true,
  height = 260,
}: {
  title: string;
  description?: string;
  data: Array<Record<string, number | string>>;
  series: ChartSeries[];
  stacked?: boolean;
  height?: number;
}) {
  const colors = useColors();
  const isEmpty = data.every((row) => series.every((s) => !Number(row[s.key])));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <ChartLegend series={series} />
      </div>
      <div className="relative w-full" style={{ height }}>
        {isEmpty ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            No activity in this period
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.xaxis} strokeOpacity={0.12} />
            <XAxis
              dataKey="date"
              fontSize={11}
              className="font-mono"
              tick={{ fill: colors.xaxis, fillOpacity: 0.65 }}
              tickFormatter={(value: string) => value.slice(5)}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              fontSize={11}
              className="font-mono"
              tick={{ fill: colors.xaxis, fillOpacity: 0.65 }}
              tickFormatter={(value: number) => formatCompact(value)}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
            />
            <Tooltip cursor={{ fill: colors.xaxis, fillOpacity: 0.06 }} content={<ChartTooltip series={series} />} />
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId={stacked ? "stack" : undefined}
                fill={s.color}
                maxBarSize={20}
                radius={!stacked || index === series.length - 1 ? [2.5, 2.5, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
