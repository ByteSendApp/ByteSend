"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { AdminPageHeader } from "../_components/admin-page-header";
import { StatusPill, type StatusTone } from "../_components/status-pill";
import { formatNumber } from "../_components/format";

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  LISTED: { label: "Listed", tone: "destructive" },
  CLEAN: { label: "Clean", tone: "success" },
  ERROR: { label: "Unknown", tone: "muted" },
};

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: StatusTone }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      {tone ? <StatusPill tone={tone}>{label}</StatusPill> : <span className="text-sm text-muted-foreground">{label}</span>}
      <span className="font-mono text-xl font-semibold tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

export default function AdminBlacklistsPage() {
  const utils = api.useUtils();
  const overviewQuery = api.admin.getBlacklistOverview.useQuery();
  const overview = overviewQuery.data;

  const recheck = api.admin.recheckDomainBlacklist.useMutation({
    onSuccess: async (results) => {
      const listed = results.filter((result) => result.status === "LISTED").length;
      if (listed > 0) {
        toast.error(`Listed on ${listed} blocklist${listed === 1 ? "" : "s"}`);
      } else {
        toast.success("Re-check complete");
      }
      await Promise.all([utils.admin.getBlacklistOverview.invalidate(), utils.admin.listAuditLog.invalidate()]);
    },
    onError: (error) => toast.error("Could not re-check", { description: error.message }),
  });

  const listedDomains = overview?.domains.filter((entry) => entry.checks.some((check) => check.status === "LISTED")).length ?? 0;
  const unknownDomains =
    overview?.domains.filter(
      (entry) =>
        !entry.checks.some((check) => check.status === "LISTED") && entry.checks.some((check) => check.status === "ERROR"),
    ).length ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Blacklists"
        description="Verified sending domains checked daily (04:30 UTC) against domain blocklists. SES sends from shared AWS IPs, so only domains are checked."
      />

      {overview && !overview.usesDqsKey ? (
        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-foreground">
            No <code className="font-mono text-xs">SPAMHAUS_DQS_KEY</code> is set. Spamhaus, SURBL and URIBL refuse queries from
            public and cloud DNS resolvers, so those results show as <strong>Unknown</strong> instead of a false
            &ldquo;clean&rdquo;. Add a free Spamhaus DQS key for reliable Spamhaus results.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Verified domains" value={overview?.verifiedCount ?? 0} />
        <SummaryTile label="Listed" value={listedDomains} tone="destructive" />
        <SummaryTile label="Unknown" value={unknownDomains} tone="muted" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Domain</TableHead>
                {(overview?.lists ?? []).map((list) => (
                  <TableHead key={list.id}>{list.name}</TableHead>
                ))}
                <TableHead>Checked</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewQuery.isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !overview || overview.domains.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={(overview?.lists.length ?? 3) + 3} className="h-32 text-center text-sm text-muted-foreground">
                    No checks have run yet. The first daily run covers every verified domain.
                  </TableCell>
                </TableRow>
              ) : (
                overview.domains.map((entry) => (
                  <TableRow key={entry.domain.id}>
                    <TableCell>
                      <p className="font-mono text-sm">{entry.domain.name}</p>
                      <Link
                        href={`/admin/teams/${entry.domain.team.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {entry.domain.team.name}
                      </Link>
                    </TableCell>
                    {overview.lists.map((list) => {
                      const check = entry.checks.find((item) => item.list === list.id);
                      if (!check) {
                        return (
                          <TableCell key={list.id}>
                            <span className="text-xs text-muted-foreground">—</span>
                          </TableCell>
                        );
                      }
                      const meta = STATUS_META[check.status] ?? STATUS_META.ERROR!;
                      return (
                        <TableCell key={list.id}>
                          <div className="flex items-center gap-1.5" title={check.returnCode ?? undefined}>
                            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                            {check.status === "LISTED" ? (
                              <a
                                href={list.removalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`${list.name} delisting`}
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDistanceToNow(entry.lastCheckedAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={recheck.isPending}
                        onClick={() => recheck.mutate({ domainId: entry.domain.id })}
                      >
                        <RefreshCw
                          className={`mr-1.5 size-3.5 ${recheck.isPending && recheck.variables?.domainId === entry.domain.id ? "animate-spin" : ""}`}
                        />
                        Re-check
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
