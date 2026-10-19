"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import type { EmailStatus } from "@prisma/client";
import { Button } from "@bytesend/ui/src/button";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { api } from "~/trpc/react";
import { EmailStatusBadge } from "../../emails/email-status-badge";
import { AdminPageHeader } from "../_components/admin-page-header";
import { SearchInput } from "../_components/search-input";
import { EmailDetailSheet } from "./email-detail-sheet";

const HOUR_MS = 60 * 60 * 1000;
const WINDOWS = [
  { value: "1h", label: "Last hour", ms: HOUR_MS },
  { value: "24h", label: "Last 24 hours", ms: 24 * HOUR_MS },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * HOUR_MS },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * HOUR_MS },
] as const;
type WindowValue = (typeof WINDOWS)[number]["value"];

const STATUS_FILTERS: Array<{ value: string; label: string; statuses?: EmailStatus[] }> = [
  { value: "all", label: "All statuses" },
  { value: "problems", label: "Problems", statuses: ["BOUNCED", "COMPLAINED", "FAILED", "REJECTED", "RENDERING_FAILURE"] },
  { value: "delivered", label: "Delivered", statuses: ["DELIVERED", "OPENED", "CLICKED"] },
  { value: "bounced", label: "Bounced", statuses: ["BOUNCED"] },
  { value: "complained", label: "Complained", statuses: ["COMPLAINED"] },
  { value: "delayed", label: "Delayed", statuses: ["DELIVERY_DELAYED"] },
  { value: "in_flight", label: "Queued / scheduled", statuses: ["QUEUED", "SCHEDULED", "SENT"] },
  { value: "suppressed", label: "Suppressed", statuses: ["SUPPRESSED"] },
];

const PAGE_SIZE = 50;

function computeRange(timeWindow: WindowValue) {
  const to = new Date();
  const ms = WINDOWS.find((option) => option.value === timeWindow)?.ms ?? 24 * HOUR_MS;
  return { from: new Date(to.getTime() - ms), to };
}

function AdminEmailsExplorer() {
  const searchParams = useSearchParams();
  const initialTeamId = Number(searchParams.get("teamId")) || undefined;

  const [timeWindow, setTimeWindow] = useState<WindowValue>("24h");
  const [range, setRange] = useState(() => computeRange("24h"));
  const [status, setStatus] = useState("all");
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [teamId, setTeamId] = useState<number | undefined>(initialTeamId);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));

  const statuses = useMemo(() => STATUS_FILTERS.find((option) => option.value === status)?.statuses, [status]);

  const emailsQuery = api.admin.listEmails.useInfiniteQuery(
    {
      limit: PAGE_SIZE,
      from: range.from,
      to: range.to,
      teamId,
      statuses,
      recipient: recipient || undefined,
      sender: sender || undefined,
      subject: subject || undefined,
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const emails = emailsQuery.data?.pages.flatMap((page) => page.emails) ?? [];

  return (
    <>
      <AdminPageHeader
        title="Emails"
        description="Search sending history across every team"
        actions={
          <Button variant="outline" size="sm" onClick={() => setRange(computeRange(timeWindow))}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Select
          value={timeWindow}
          onValueChange={(value) => {
            setTimeWindow(value as WindowValue);
            setRange(computeRange(value as WindowValue));
          }}
        >
          <SelectTrigger aria-label="Time window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput onSearch={setRecipient} placeholder="Recipient (exact address)" label="Recipient" />
        <SearchInput onSearch={setSender} placeholder="Sender contains" label="Sender" />
        <SearchInput onSearch={setSubject} placeholder="Subject contains" label="Subject" />
      </div>

      {teamId ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered to team</span>
          <Link href={`/admin/teams/${teamId}`} className="font-mono hover:underline">
            #{teamId}
          </Link>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => setTeamId(undefined)} aria-label="Clear team filter">
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-36">Status</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-36">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailsQuery.isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : emailsQuery.isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-destructive">
                    {emailsQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : emails.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    No emails match these filters in this window
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id} className="cursor-pointer" onClick={() => setSelectedId(email.id)}>
                    <TableCell>
                      <EmailStatusBadge status={email.latestStatus} />
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="truncate text-sm">{email.subject || "(no subject)"}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{email.from}</p>
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs">
                      {email.to[0]}
                      {email.to.length > 1 ? (
                        <span className="text-muted-foreground"> +{email.to.length - 1}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">{email.team.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <span title={format(email.createdAt, "yyyy-MM-dd HH:mm:ss")}>
                        {formatDistanceToNow(email.createdAt, { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {emailsQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => emailsQuery.fetchNextPage()}
            disabled={emailsQuery.isFetchingNextPage}
          >
            {emailsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      <EmailDetailSheet emailId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <AdminEmailsExplorer />
    </Suspense>
  );
}
