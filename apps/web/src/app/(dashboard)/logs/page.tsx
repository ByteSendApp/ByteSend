"use client";

import { useMemo, useState } from "react";
import { formatDate, formatDistanceToNow } from "date-fns";
import { ScrollText } from "lucide-react";
import { api } from "~/trpc/react";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { FilterBar, SearchInput } from "@bytesend/ui/src/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bytesend/ui/src/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";

const SOURCE_FILTERS = ["ALL", "EMAIL", "WEBHOOK", "NOTIFICATION"] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

const SOURCE_LABEL: Record<SourceFilter, string> = {
  ALL: "All sources",
  EMAIL: "Emails",
  WEBHOOK: "Webhooks",
  NOTIFICATION: "Notifications",
};

const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ");

function statusVariant(status: string): BadgeProps["variant"] {
  if (["DELIVERED", "SENT", "OPENED", "CLICKED", "SUCCESS"].includes(status)) return "success";
  if (["FAILED", "BOUNCED", "COMPLAINED", "REJECTED", "DISCARDED"].includes(status)) return "danger";
  if (["PENDING", "IN_PROGRESS", "QUEUED", "SCHEDULED", "DELIVERY_DELAYED"].includes(status)) return "warning";
  return "neutral";
}

function detailFor(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { lastError?: string | null; responseStatus?: number | null };
  if (m.lastError) return m.lastError;
  if (m.responseStatus) return `HTTP ${m.responseStatus}`;
  return null;
}

export default function LogsPage() {
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const logsQuery = api.logs.list.useQuery({ limit: 200, source: source === "ALL" ? undefined : source });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (logsQuery.data ?? []).filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!term) return true;
      return [row.title, row.kind, row.status, row.target, detailFor(row.metadata)].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [logsQuery.data, search, status]);

  const statusOptions = useMemo(() => Array.from(new Set((logsQuery.data ?? []).map((row) => row.status))).sort(), [logsQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Email events, webhook deliveries and notifications for your team, newest first. Shows the latest 200."
      />

      <FilterBar>
        <SearchInput placeholder="Search events" className="w-full sm:w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
            <SelectTrigger className="h-8 w-full text-[13px] sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {SOURCE_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-full text-[13px] capitalize sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any status</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {humanize(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <Panel flush>
        {logsQuery.isLoading ? (
          <ListSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title={logsQuery.data?.length ? "Nothing matches these filters" : "No activity yet"}
            description={logsQuery.data?.length ? "Try another source, status or search." : "Sends, webhook deliveries and notifications will be recorded here."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Event</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="hidden md:table-cell">Target</TableHead>
                <TableHead className="hidden lg:table-cell">Detail</TableHead>
                <TableHead className="w-32 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const detail = detailFor(row.metadata);
                return (
                  <TableRow key={`${row.source}-${row.id}`}>
                    <TableCell className="max-w-0">
                      <p className="truncate font-medium text-foreground">{row.title}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {humanize(row.source)} · {humanize(row.kind)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)} dot className="capitalize">
                        {humanize(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-0 text-muted-foreground md:table-cell">
                      <p className="truncate">{row.target}</p>
                    </TableCell>
                    <TableCell className="hidden max-w-0 text-xs text-muted-foreground lg:table-cell">
                      <p className="truncate" title={detail ?? undefined}>
                        {detail ?? "–"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span title={formatDate(new Date(row.createdAt), "PPpp")}>
                        {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
