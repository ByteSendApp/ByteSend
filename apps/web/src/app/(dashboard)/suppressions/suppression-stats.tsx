"use client";

import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { api } from "~/trpc/react";

export default function SuppressionStats() {
  const { data: stats, isLoading } = api.suppression.getSuppressionStats.useQuery();

  if (isLoading) return <Skeleton className="h-18.5 rounded-lg" />;

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <StatGroup>
      <Stat label="Suppressed addresses" value={total.toLocaleString()} />
      <Stat label="Hard bounces" value={(stats?.HARD_BOUNCE ?? 0).toLocaleString()} hint="Address doesn't exist" />
      <Stat label="Complaints" value={(stats?.COMPLAINT ?? 0).toLocaleString()} hint="Marked as spam" />
      <Stat label="Added by you" value={(stats?.MANUAL ?? 0).toLocaleString()} hint="Manually or in bulk" />
    </StatGroup>
  );
}
