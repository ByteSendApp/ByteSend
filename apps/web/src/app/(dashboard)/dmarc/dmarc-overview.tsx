"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ShieldCheck } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Panel } from "@bytesend/ui/src/panel";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import type { AppRouter } from "~/server/api/root";
import { useColors } from "../dashboard/hooks/useColors";

type Summary = inferRouterOutputs<AppRouter>["dmarc"]["summary"];

export const percent = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 1000) / 10}%`);

export function ResultBadge({ passed, total }: { passed: number; total: number }) {
  const rate = total === 0 ? 0 : passed / total;
  return (
    <Badge variant={rate >= 0.98 ? "success" : rate >= 0.8 ? "warning" : "danger"} className="tabular-nums">
      {percent(passed, total)}
    </Badge>
  );
}

export function DmarcOverview({ summary, isLoading, onSetUp }: { summary?: Summary; isLoading: boolean; onSetUp: () => void }) {
  const colors = useColors();

  if (isLoading) return <ListSkeleton rows={6} />;
  if (!summary || summary.totals.reports === 0) {
    return (
      <Panel flush>
        <EmptyState
          icon={<ShieldCheck />}
          title="No reports in this period"
          description="Point your domain's DMARC record at your report address. Providers send reports about once a day, so the first ones arrive within 24 to 48 hours."
          action={
            <Button size="sm" variant="outline" onClick={onSetUp}>
              Set up reporting
            </Button>
          }
        />
      </Panel>
    );
  }

  const { totals, daily, sources } = summary;
  const passRate = totals.messages === 0 ? 1 : totals.passed / totals.messages;
  const unknownFailing = sources.filter((s) => !s.viaByteSend && s.dmarcPass < s.messages);

  return (
    <div className="space-y-4">
      <StatGroup>
        <Stat label="Messages reported" value={totals.messages.toLocaleString()} hint={`${totals.reports.toLocaleString()} reports`} />
        <Stat
          label="DMARC pass rate"
          value={percent(totals.passed, totals.messages)}
          tone={passRate >= 0.98 ? "success" : passRate >= 0.8 ? "warning" : "danger"}
        />
        <Stat label="Failing messages" value={totals.failed.toLocaleString()} tone={totals.failed > 0 ? "warning" : "default"} />
        <Stat label="Sending sources" value={sources.length.toLocaleString()} hint={`${unknownFailing.length} failing outside ByteSend`} />
      </StatGroup>

      <Panel title="Results by day">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="date" fontSize={11} stroke={colors.xaxis} tick={{ fill: colors.xaxis }} axisLine={false} tickLine={false} minTickGap={24} />
              <Tooltip
                cursor={{ fill: colors.grid, opacity: 0.5 }}
                content={({ payload }) => {
                  const day = payload?.[0]?.payload as { date: string; pass: number; fail: number } | undefined;
                  if (!day) return null;
                  return (
                    <div className="min-w-36 space-y-1 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium text-foreground">{day.date}</p>
                      <p className="flex justify-between gap-4 text-muted-foreground">
                        Passed <span className="tabular-nums text-foreground">{day.pass.toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between gap-4 text-muted-foreground">
                        Failed <span className="tabular-nums text-foreground">{day.fail.toLocaleString()}</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="pass" stackId="a" fill={colors.delivered} maxBarSize={22} />
              <Bar dataKey="fail" stackId="a" fill={colors.bounced} maxBarSize={22} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        flush
        title="Sending sources"
        description="Every server that sent mail as your domains. Failing sources you don't recognise may be spoofing you, or a service you still need to set up."
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Source</TableHead>
              <TableHead className="hidden md:table-cell">From domain</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="hidden text-right sm:table-cell">DKIM</TableHead>
              <TableHead className="hidden text-right sm:table-cell">SPF</TableHead>
              <TableHead className="text-right">DMARC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.slice(0, 100).map((source) => (
              <TableRow key={`${source.sourceIp}|${source.headerFrom}`}>
                <TableCell className="max-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                    <span className="truncate">{source.sourceHost ?? source.sourceIp}</span>
                    {source.viaByteSend ? (
                      <Badge variant="brand" className="shrink-0">
                        ByteSend
                      </Badge>
                    ) : null}
                  </p>
                  {source.sourceHost ? <p className="truncate font-mono text-xs text-muted-foreground">{source.sourceIp}</p> : null}
                </TableCell>
                <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">{source.headerFrom}</TableCell>
                <TableCell className="text-right tabular-nums">{source.messages.toLocaleString()}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{percent(source.dkimPass, source.messages)}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{percent(source.spfPass, source.messages)}</TableCell>
                <TableCell className="text-right">
                  <ResultBadge passed={source.dmarcPass} total={source.messages} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
