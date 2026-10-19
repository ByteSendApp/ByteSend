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
import { AdminPageHeader } from "../_components/admin-page-header";
import { Pagination } from "../_components/pagination";
import { SearchInput } from "../_components/search-input";
import { StatusPill } from "../_components/status-pill";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const usersQuery = api.admin.listUsers.useQuery(
    { page, pageSize: PAGE_SIZE, query: query || undefined },
    { placeholderData: (prev) => prev },
  );
  const users = usersQuery.data?.users ?? [];

  return (
    <>
      <AdminPageHeader title="Users" description="Everyone with a ByteSend account. Open one to manage access and flags." />

      <SearchInput
        onSearch={(value) => {
          setPage(1);
          setQuery(value);
        }}
        placeholder="ID, email, or name"
        label="Search users"
        className="sm:max-w-md"
      />

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>User</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : usersQuery.isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="h-32 text-center text-sm text-destructive">
                    Failed to load users: {usersQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="h-32 text-center text-sm text-muted-foreground">
                    {query ? `No users match "${query}"` : "No users yet"}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <TableCell>
                      <Link
                        href={`/admin/users/${user.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-medium text-foreground hover:underline"
                      >
                        {user.name ?? user.email}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {user.name ? `${user.email} · ` : ""}
                        <span className="font-mono">#{user.id}</span>
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.isBanned ? <StatusPill tone="destructive">Banned</StatusPill> : null}
                        {user.evasion ? (
                          <span title={user.evasion.reason}>
                            <StatusPill tone={user.evasion.level === "match" ? "destructive" : "warning"}>
                              {user.evasion.level === "match" ? "Ban evasion" : "Possible evasion"}
                            </StatusPill>
                          </span>
                        ) : null}
                        {user.isAdmin ? <StatusPill tone="warning">Admin</StatusPill> : null}
                        {user.isBetaUser ? <StatusPill tone="muted">Beta</StatusPill> : null}
                        {!user.isBanned && !user.evasion && !user.isAdmin && !user.isBetaUser ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {usersQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={usersQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}
