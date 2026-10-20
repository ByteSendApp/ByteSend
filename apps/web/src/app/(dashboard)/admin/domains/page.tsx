"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@bytesend/ui/src/button";
import Spinner from "@bytesend/ui/src/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { Badge } from "@bytesend/ui/src/badge";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { AdminPageHeader } from "../_components/admin-page-header";
import { Pagination } from "../_components/pagination";
import { SearchInput } from "../_components/search-input";
import { isCloud } from "~/utils/common";
import { DomainStatusBadge } from "../../domains/domain-badge";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AdminDomain = NonNullable<RouterOutputs["admin"]["listAdminDomains"]>["domains"][number];

export default function AdminDomainsPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const utils = api.useUtils();
  const domainsQuery = api.admin.listAdminDomains.useQuery(
    { page, pageSize: 20, query: query || undefined },
    { placeholderData: (prev) => prev },
  );

  const forceVerify = api.admin.adminForceVerifyDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain force-verified");
      void domainsQuery.refetch();
      void utils.admin.listAuditLog.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to verify domain"),
  });

  const deleteDomain = api.admin.adminDeleteDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain deleted");
      void domainsQuery.refetch();
      void utils.admin.listAuditLog.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to delete domain"),
  });

  if (!isCloud()) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        Domain administration is available only in the cloud deployment.
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader title="Domains" description="Every sending domain across all teams" />
      <SearchInput
        onSearch={(value) => {
          setPage(1);
          setQuery(value);
        }}
        placeholder="Filter by domain, team, or region"
        label="Search domains"
        className="sm:max-w-md"
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Domain</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="rounded-tr-xl text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domainsQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  <Spinner className="mx-auto h-6 w-6" innerSvgClass="stroke-primary" />
                </TableCell>
              </TableRow>
            ) : domainsQuery.isError ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center text-destructive">
                  Failed to load domains.
                </TableCell>
              </TableRow>
            ) : !domainsQuery.data?.domains.length ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  No domains found.
                </TableCell>
              </TableRow>
            ) : (
              domainsQuery.data.domains.map((domain: AdminDomain) => (
                <TableRow key={domain.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{domain.name}</p>
                      <p className="text-xs text-muted-foreground">ID #{domain.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Link href={`/admin/teams/${domain.team.id}`} className="font-medium hover:underline">{domain.team.name}</Link>
                      <p className="text-xs text-muted-foreground">{domain.team.plan}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{domain.region}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <DomainStatusBadge status={domain.status} />
                      {domain.isVerifying ? <Badge variant="secondary">Verifying</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {domain.clickTracking ? <Badge variant="outline">Click</Badge> : null}
                      {domain.openTracking ? <Badge variant="outline">Open</Badge> : null}
                      {!domain.clickTracking && !domain.openTracking ? (
                        <span className="text-xs text-muted-foreground">Disabled</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(domain.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {domain.status !== "SUCCESS" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          disabled={forceVerify.isPending}
                          title="Force verify"
                          onClick={() => forceVerify.mutate({ domainId: domain.id })}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deleteDomain.isPending}
                        title="Delete domain"
                        onClick={() => {
                          if (!window.confirm(`Delete domain "${domain.name}"? This is permanent.`)) return;
                          deleteDomain.mutate({ domainId: domain.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {domainsQuery.data ? (
        <Pagination page={page} pageSize={20} total={domainsQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}