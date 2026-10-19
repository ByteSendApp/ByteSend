"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
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
import { isCloud } from "~/utils/common";
import { AdminPageHeader } from "../_components/admin-page-header";
import { Pagination } from "../_components/pagination";
import { SearchInput } from "../_components/search-input";
import { StatusPill } from "../_components/status-pill";

const PAGE_SIZE = 20;

function TeamsTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const teamsQuery = api.admin.listTeams.useQuery(
    { page, pageSize: PAGE_SIZE, query: query || undefined },
    { placeholderData: (prev) => prev },
  );
  const teams = teamsQuery.data?.teams ?? [];

  return (
    <>
      <SearchInput
        onSearch={(value) => {
          setPage(1);
          setQuery(value);
        }}
        placeholder="ID, name, member email, domain, or subscription ID"
        label="Search teams"
        className="sm:max-w-md"
      />

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Team</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Domains</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsQuery.isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : teamsQuery.isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-destructive">
                    Failed to load teams: {teamsQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : teams.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    {query ? `No teams match "${query}"` : "No teams yet"}
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => {
                  const owner = team.teamUsers.find((member) => member.role === "ADMIN")?.user;
                  const verifiedDomains = team.domains.filter((domain) => domain.status === "SUCCESS").length;
                  return (
                    <TableRow
                      key={team.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/teams/${team.id}`)}
                    >
                      <TableCell>
                        <Link
                          href={`/admin/teams/${team.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-foreground hover:underline"
                        >
                          {team.name}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">#{team.id}</p>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone="muted">{team.plan}</StatusPill>
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                        {owner?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{team.teamUsers.length}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {verifiedDomains}
                        <span className="text-muted-foreground">/{team.domains.length}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDistanceToNow(team.createdAt, { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {team.isBlocked ? (
                          <StatusPill tone="destructive">Blocked</StatusPill>
                        ) : (
                          <StatusPill tone="success">Active</StatusPill>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {teamsQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={teamsQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}

export default function AdminTeamsPage() {
  return (
    <>
      <AdminPageHeader title="Teams" description="Every team on the platform. Open one to manage limits, plan and access." />
      {isCloud() ? (
        <TeamsTable />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Team administration is only available in the cloud deployment.
        </div>
      )}
    </>
  );
}
