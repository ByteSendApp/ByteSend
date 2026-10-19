"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bytesend/ui/src/select";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { AdminPageHeader } from "../_components/admin-page-header";
import { Pagination } from "../_components/pagination";
import { SearchInput } from "../_components/search-input";
import { StatusPill } from "../_components/status-pill";

const PAGE_SIZE = 25;
const ALL = "ALL";

type BlocklistType = "EMAIL" | "EMAIL_DOMAIN" | "SENDING_DOMAIN";

const TYPE_LABELS: Record<BlocklistType, { label: string; hint: string; placeholder: string }> = {
  EMAIL: { label: "Email", hint: "Blocks this mailbox and its aliases from signing up", placeholder: "someone@gmail.com" },
  EMAIL_DOMAIN: { label: "Email domain", hint: "Blocks sign-ups from any address at this domain", placeholder: "throwaway-mail.com" },
  SENDING_DOMAIN: { label: "Sending domain", hint: "Blocks adding this domain or its subdomains", placeholder: "scam-example.com" },
};

export default function AdminBlocklistPage() {
  const utils = api.useUtils();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BlocklistType | typeof ALL>(ALL);

  const [newType, setNewType] = useState<BlocklistType>("SENDING_DOMAIN");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");

  const listQuery = api.admin.listBlocklist.useQuery(
    { page, pageSize: PAGE_SIZE, query: query || undefined, type: filter === ALL ? undefined : filter },
    { placeholderData: (prev) => prev },
  );

  const refresh = () => Promise.all([utils.admin.listBlocklist.invalidate(), utils.admin.listAuditLog.invalidate()]);

  const add = api.admin.addBlocklistEntry.useMutation({
    onSuccess: async (entry) => {
      toast.success(`Blocked ${entry.value}`);
      setNewValue("");
      setNewReason("");
      await refresh();
    },
    onError: (error) => toast.error("Could not add entry", { description: error.message }),
  });
  const remove = api.admin.removeBlocklistEntry.useMutation({
    onSuccess: async (entry) => {
      toast.success(`Unblocked ${entry.value}`);
      await refresh();
    },
    onError: (error) => toast.error("Could not remove entry", { description: error.message }),
  });

  const entries = listQuery.data?.entries ?? [];

  return (
    <>
      <AdminPageHeader
        title="Blocklist"
        description="Email addresses and domains that can't sign up or be added for sending. Banning a user adds their addresses here automatically."
      />

      <form
        className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:grid-cols-[180px_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ type: newType, value: newValue, reason: newReason || undefined });
        }}
      >
        <Select value={newType} onValueChange={(value) => setNewType(value as BlocklistType)}>
          <SelectTrigger aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as BlocklistType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          placeholder={TYPE_LABELS[newType].placeholder}
          aria-label="Value"
        />
        <Input value={newReason} onChange={(event) => setNewReason(event.target.value)} placeholder="Reason (optional)" aria-label="Reason" />
        <Button type="submit" variant="destructive" disabled={newValue.trim().length < 3 || add.isPending}>
          {add.isPending ? "Blocking…" : "Block"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-4">{TYPE_LABELS[newType].hint}.</p>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          onSearch={(value) => {
            setPage(1);
            setQuery(value);
          }}
          placeholder="Search blocked values"
          label="Search blocklist"
          className="sm:max-w-md"
        />
        <Select
          value={filter}
          onValueChange={(value) => {
            setPage(1);
            setFilter(value as BlocklistType | typeof ALL);
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {(Object.keys(TYPE_LABELS) as BlocklistType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Value</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    Nothing blocked{query || filter !== ALL ? " matches" : " yet"}.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.value}</TableCell>
                    <TableCell>
                      <StatusPill tone={entry.type === "SENDING_DOMAIN" ? "warning" : "destructive"}>
                        {TYPE_LABELS[entry.type as BlocklistType].label}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      <span className="line-clamp-2">{entry.reason ?? "No reason given"}</span>
                      {entry.sourceUserId ? (
                        <Link href={`/admin/users/${entry.sourceUserId}`} className="text-xs text-primary hover:underline">
                          From ban of #{entry.sourceUserId}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Unblock ${entry.value}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ id: entry.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {listQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}
