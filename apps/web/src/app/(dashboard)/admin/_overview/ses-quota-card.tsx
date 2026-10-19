"use client";

import Link from "next/link";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { cn } from "@bytesend/ui/lib/utils";
import { api } from "~/trpc/react";
import { StatusPill } from "../_components/status-pill";
import { formatCompact, formatNumber, ratio } from "../_components/format";

export function SesQuotaCard() {
  const quotasQuery = api.admin.getSesQuotas.useQuery(undefined, { staleTime: 60_000 });

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">SES regions</h3>
          <p className="text-xs text-muted-foreground">24-hour send quota per region</p>
        </div>
        <Link href="/admin/ses" className="text-xs text-muted-foreground hover:text-foreground">
          Manage
        </Link>
      </div>

      {quotasQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !quotasQuery.data?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No SES regions configured</p>
      ) : (
        <ul className="space-y-4">
          {quotasQuery.data.map((quota) => {
            const used = ratio(quota.sentLast24Hours ?? 0, quota.max24HourSend ?? 0);
            return (
              <li key={quota.region} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-foreground">{quota.region}</span>
                  {!quota.isActive ? <StatusPill tone="muted">Inactive</StatusPill> : null}
                  {quota.error ? (
                    <StatusPill tone="destructive">Unreachable</StatusPill>
                  ) : quota.productionAccessEnabled === false ? (
                    <StatusPill tone="warning">Sandbox</StatusPill>
                  ) : quota.enforcementStatus && quota.enforcementStatus !== "HEALTHY" ? (
                    <StatusPill tone="destructive">{quota.enforcementStatus}</StatusPill>
                  ) : (
                    <StatusPill tone="success">Healthy</StatusPill>
                  )}
                </div>
                {quota.error ? (
                  <p className="truncate text-xs text-muted-foreground" title={quota.error}>
                    {quota.error}
                  </p>
                ) : (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          used >= 0.9 ? "bg-destructive" : used >= 0.7 ? "bg-warning" : "bg-success",
                        )}
                        style={{ width: `${Math.min(used, 1) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                      <span>
                        {formatNumber(quota.sentLast24Hours ?? 0)} / {formatCompact(quota.max24HourSend ?? 0)}
                      </span>
                      <span>{quota.maxSendRate ?? 0}/s</span>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
