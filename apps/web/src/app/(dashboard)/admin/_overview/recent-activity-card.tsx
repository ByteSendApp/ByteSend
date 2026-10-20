"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { api } from "~/trpc/react";
import { adminAuditActionLabel } from "~/lib/constants/admin-audit";

function describeTarget(targetType: string, targetId: string, metadata: unknown) {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const name = meta.teamName ?? meta.domainName ?? meta.email;
  return typeof name === "string" ? name : `${targetType} #${targetId}`;
}

export function RecentActivityCard() {
  const activityQuery = api.admin.listAuditLog.useQuery({ limit: 6 }, { staleTime: 30_000 });
  const entries = activityQuery.data?.entries ?? [];

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">Recent admin activity</h3>
          <p className="text-xs text-muted-foreground">Latest changes from the audit log</p>
        </div>
        <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>

      {activityQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No admin actions recorded yet</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {adminAuditActionLabel(entry.action)}{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="font-medium">
                    {describeTarget(entry.targetType, entry.targetId, entry.metadata)}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.actor?.email ?? entry.actorEmail ?? "Deleted user"} ·{" "}
                  {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
