"use client";

import { DomainStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Globe } from "lucide-react";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { api } from "~/trpc/react";
import { RegionLabel } from "~/components/dashboard/region-label";
import { DomainStatusBadge } from "./domain-badge";

const NEEDS_DNS: DomainStatus[] = [DomainStatus.FAILED, DomainStatus.PENDING, DomainStatus.NOT_STARTED, DomainStatus.TEMPORARY_FAILURE];

function formatRate(part: number, total: number) {
  if (total === 0) return "–";
  return `${((part / total) * 100).toFixed(part / total < 0.1 ? 2 : 1)}%`;
}

export default function DomainsList({ action }: { action?: React.ReactNode }) {
  const router = useRouter();
  const domainsQuery = api.domain.domains.useQuery();
  const statsQuery = api.domain.domainStats.useQuery();

  if (domainsQuery.isLoading) {
    return (
      <Panel flush>
        <ListSkeleton rows={4} />
      </Panel>
    );
  }

  if (!domainsQuery.data?.length) {
    return (
      <Panel flush>
        <EmptyState
          icon={<Globe />}
          title="Add your first domain"
          description="You send from your own domain. Add it here, then add the DNS records we give you to verify it."
          action={action}
        />
      </Panel>
    );
  }

  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Domain</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Region</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Sent · 30d</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Bounce rate</TableHead>
            <TableHead className="hidden lg:table-cell">Added</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {domainsQuery.data.map((domain) => {
            const stats = statsQuery.data?.[domain.id];
            const href = `/domains/${domain.id}`;
            return (
              <TableRow key={domain.id} className="group cursor-pointer" onClick={() => router.push(href)}>
                <TableCell>
                  <Link href={href} className="font-medium text-foreground" onClick={(e) => e.stopPropagation()}>
                    {domain.name}
                  </Link>
                  {NEEDS_DNS.includes(domain.status) ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {domain.status === DomainStatus.FAILED ? "DNS records not found. Open to see what to fix." : "Waiting for DNS records"}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <DomainStatusBadge status={domain.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <RegionLabel region={domain.region} />
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {stats ? stats.sent.toLocaleString() : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                  {stats ? formatRate(stats.hardBounced, stats.delivered + stats.hardBounced) : "–"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDistanceToNow(new Date(domain.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <ChevronRight className="ml-auto size-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}
