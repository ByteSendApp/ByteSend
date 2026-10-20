"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import { useDebouncedCallback } from "use-debounce";
import { SuppressionReason } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@bytesend/ui/src/button";
import { Badge } from "@bytesend/ui/src/badge";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { FilterBar, SearchInput } from "@bytesend/ui/src/search-input";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
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
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import RemoveSuppressionDialog from "./remove-suppression";
import { toast } from "@bytesend/ui/src/toaster";

const reasonLabels = {
  HARD_BOUNCE: "Hard bounce",
  COMPLAINT: "Complaint",
  MANUAL: "Added by you",
} as const;

const REASON_VARIANT = {
  HARD_BOUNCE: "danger",
  COMPLAINT: "warning",
  MANUAL: "neutral",
} as const;

export default function SuppressionList() {
  const [search, setSearch] = useUrlState("search");
  const [reason, setReason] = useUrlState("reason");
  const [page, setPage] = useUrlState("page", "1");
  const [emailToRemove, setEmailToRemove] = useState<string | null>(null);

  const suppressionsQuery = api.suppression.getSuppressions.useQuery({
    page: parseInt(page || "1"),
    limit: 20,
    search: search || undefined,
    reason: reason as SuppressionReason | undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const exportQuery = api.suppression.exportSuppressions.useQuery(
    {
      search: search || undefined,
      reason: reason as SuppressionReason | undefined,
    },
    { enabled: false }
  );

  const utils = api.useUtils();

  const removeMutation = api.suppression.removeSuppression.useMutation({
    onSuccess: () => {
      utils.suppression.getSuppressions.invalidate();
      utils.suppression.getSuppressionStats.invalidate();
      setEmailToRemove(null);
      toast.success("Suppression removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove suppression");
    },
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    setPage("1");
  }, 1000);

  const handleReasonFilter = (value: string) => {
    setReason(value === "all" ? null : value);
    setPage("1");
  };

  const handleExport = async () => {
    const resp = await exportQuery.refetch();

    if (resp.data) {
      const csv = [
        "Email,Reason,Created At",
        ...resp.data.map(
          (suppression) =>
            `${suppression.email},${suppression.reason},${suppression.createdAt}`
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suppressions-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const handleRemove = (email: string) => {
    setEmailToRemove(email);
  };

  const confirmRemove = async () => {
    if (emailToRemove) {
      await removeMutation.mutateAsync({ email: emailToRemove.trim() });
    }
  };

  const suppressions = suppressionsQuery.data?.suppressions ?? [];
  const pageNumber = parseInt(page || "1");
  const hasFilters = Boolean(search || reason);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <SearchInput
          placeholder="Search by email address"
          className="w-full sm:w-72"
          defaultValue={search || ""}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <Select value={reason || "all"} onValueChange={handleReasonFilter}>
            <SelectTrigger className="h-8 w-full text-[13px] sm:w-40">
              <SelectValue placeholder="Any reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any reason</SelectItem>
              <SelectItem value="HARD_BOUNCE">Hard bounce</SelectItem>
              <SelectItem value="COMPLAINT">Complaint</SelectItem>
              <SelectItem value="MANUAL">Added by you</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exportQuery.isFetching}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      <Panel
        flush
        footer={
          suppressions.length || pageNumber > 1 ? (
            <PaginationBar
              page={pageNumber}
              hasNext={Boolean(suppressionsQuery.data?.pagination?.hasNext)}
              onPageChange={(next) => setPage(String(next))}
            />
          ) : null
        }
      >
        {suppressionsQuery.isLoading ? (
          <ListSkeleton rows={6} />
        ) : suppressions.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title={hasFilters ? "No addresses match" : "Nothing suppressed yet"}
            description={
              hasFilters
                ? "Try a different search or reason."
                : "When an address bounces or someone marks your email as spam, it's added here automatically so you don't send to it again."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Address</TableHead>
                <TableHead className="w-36">Reason</TableHead>
                <TableHead className="hidden w-40 sm:table-cell">Added</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppressions.map((suppression) => (
                <TableRow key={suppression.id}>
                  <TableCell className="max-w-0 font-medium">
                    <p className="truncate">{suppression.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={REASON_VARIANT[suppression.reason]} dot>
                      {reasonLabels[suppression.reason]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDistanceToNow(new Date(suppression.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${suppression.email}`}
                      onClick={() => handleRemove(suppression.email)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <RemoveSuppressionDialog
        email={emailToRemove}
        open={!!emailToRemove}
        onOpenChange={(open) => !open && setEmailToRemove(null)}
        onConfirm={confirmRemove}
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
