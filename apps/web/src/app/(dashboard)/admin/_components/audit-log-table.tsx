"use client";

import { format, formatDistanceToNow } from "date-fns";
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
import { api } from "~/trpc/react";
import { adminAuditActionLabel, type AdminAuditTargetType } from "~/lib/constants/admin-audit";
import { AuditMetadata } from "./audit-metadata";
import { StatusPill, type StatusTone } from "./status-pill";

function actionTone(action: string): StatusTone {
  if (/\.(delete|ban|block)$/.test(action)) return "destructive";
  if (/\.(unban|unblock|force_verify)$/.test(action)) return "warning";
  return "muted";
}

export function AuditLogTable({
  query,
  action,
  targetType,
  targetId,
  pageSize = 50,
  showTarget = true,
  emptyLabel = "No admin actions recorded yet",
}: {
  query?: string;
  action?: string;
  targetType?: AdminAuditTargetType;
  targetId?: string;
  pageSize?: number;
  showTarget?: boolean;
  emptyLabel?: string;
}) {
  const auditQuery = api.admin.listAuditLog.useInfiniteQuery(
    { limit: pageSize, query, action, targetType, targetId },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const entries = auditQuery.data?.pages.flatMap((page) => page.entries) ?? [];
  const columnCount = showTarget ? 5 : 4;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-40">When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                {showTarget ? <TableHead>Target</TableHead> : null}
                <TableHead className="min-w-64">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.isLoading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: columnCount }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columnCount} className="h-28 text-center text-sm text-muted-foreground">
                    {emptyLabel}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="align-top">
                    <TableCell className="whitespace-nowrap text-xs">
                      <span title={format(entry.createdAt, "yyyy-MM-dd HH:mm:ss")}>
                        {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm">
                      {entry.actor?.email ?? entry.actorEmail ?? (
                        <span className="text-muted-foreground">Deleted user</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={actionTone(entry.action)}>{adminAuditActionLabel(entry.action)}</StatusPill>
                    </TableCell>
                    {showTarget ? (
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        <span className="text-muted-foreground">{entry.targetType}</span> #{entry.targetId}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <AuditMetadata metadata={entry.metadata} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {auditQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => auditQuery.fetchNextPage()}
            disabled={auditQuery.isFetchingNextPage}
          >
            {auditQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
