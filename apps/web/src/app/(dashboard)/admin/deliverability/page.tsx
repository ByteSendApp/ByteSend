"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Switch } from "@bytesend/ui/src/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_MIN_VOLUME,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
  DELIVERABILITY_WINDOW_DAYS,
} from "~/lib/constants/deliverability";
import { AdminPageHeader } from "../_components/admin-page-header";
import { BlockTeamDialog } from "../_components/block-team-dialog";
import { RateGauge } from "../_components/rate-gauge";
import { StatusPill, type StatusTone } from "../_components/status-pill";
import { formatNumber, formatPercent } from "../_components/format";

type TeamRow = inferRouterOutputs<AppRouter>["admin"]["listDeliverability"][number];

const STATUS_META: Record<TeamRow["status"], { label: string; tone: StatusTone }> = {
  ok: { label: "Healthy", tone: "success" },
  warning: { label: "Warning", tone: "warning" },
  over_limit: { label: "Over limit", tone: "destructive" },
  low_volume: { label: "Low volume", tone: "muted" },
};

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <StatusPill tone={tone}>{label}</StatusPill>
      <span className="font-mono text-xl font-semibold tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

export default function AdminDeliverabilityPage() {
  const [atRiskOnly, setAtRiskOnly] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [dialogTeam, setDialogTeam] = useState<TeamRow | null>(null);
  const updateQuery = useDebouncedCallback((value: string) => setQuery(value.trim()), 300);

  const teamsQuery = api.admin.listDeliverability.useQuery(
    { atRiskOnly, query: query || undefined },
    { placeholderData: (prev) => prev },
  );
  const teams = teamsQuery.data ?? [];

  const counts = teams.reduce(
    (acc, team) => {
      if (team.isBlocked) acc.blocked += 1;
      if (team.status === "over_limit") acc.overLimit += 1;
      if (team.status === "warning") acc.warning += 1;
      return acc;
    },
    { blocked: 0, overLimit: 0, warning: 0 },
  );

  return (
    <>
      <AdminPageHeader
        title="Deliverability"
        description={`Hard-bounce and complaint rates per team over the last ${DELIVERABILITY_WINDOW_DAYS} days. Limits are enforced automatically once a team has ${BOUNCE_RATE_MIN_VOLUME}+ deliveries.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Over limit" value={counts.overLimit} tone="destructive" />
        <SummaryTile label="Warning" value={counts.warning} tone="warning" />
        <SummaryTile label="Blocked" value={counts.blocked} tone="muted" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              updateQuery(event.target.value);
            }}
            placeholder="Team name or ID"
            className="pl-8"
            aria-label="Search teams"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={atRiskOnly} onCheckedChange={setAtRiskOnly} />
          At-risk and blocked only
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="min-w-44">
                  Hard bounce <span className="font-normal text-muted-foreground">/ {formatPercent(BOUNCE_RATE_HARD_LIMIT, 0)}</span>
                </TableHead>
                <TableHead className="min-w-44">
                  Complaints <span className="font-normal text-muted-foreground">/ {formatPercent(COMPLAINT_RATE_HARD_LIMIT, 1)}</span>
                </TableHead>
                <TableHead className="text-right">New suppressions</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsQuery.isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : teams.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    {atRiskOnly
                      ? "No team is over a warning threshold and none are blocked."
                      : "No sending activity in this window."}
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.teamId}>
                    <TableCell>
                      <Link href={`/admin/teams/${team.teamId}`} className="group flex flex-col">
                        <span className="font-medium text-foreground group-hover:underline">{team.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          #{team.teamId} · {team.plan}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill tone={STATUS_META[team.status].tone}>{STATUS_META[team.status].label}</StatusPill>
                        {team.isBlocked ? <StatusPill tone="destructive">Blocked</StatusPill> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatNumber(team.delivered)}
                    </TableCell>
                    <TableCell>
                      <RateGauge value={team.bounceRate} warn={BOUNCE_RATE_WARN_LIMIT} hard={BOUNCE_RATE_HARD_LIMIT} />
                    </TableCell>
                    <TableCell>
                      <RateGauge
                        value={team.complaintRate}
                        warn={COMPLAINT_RATE_WARN_LIMIT}
                        hard={COMPLAINT_RATE_HARD_LIMIT}
                        fractionDigits={3}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatNumber(team.newSuppressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={team.isBlocked ? "outline" : "destructive"}
                        onClick={() => setDialogTeam(team)}
                      >
                        {team.isBlocked ? "Unblock" : "Block"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <BlockTeamDialog
        team={dialogTeam ? { id: dialogTeam.teamId, name: dialogTeam.name, isBlocked: dialogTeam.isBlocked } : null}
        open={dialogTeam !== null}
        onOpenChange={(open) => {
          if (!open) setDialogTeam(null);
        }}
      />
    </>
  );
}
