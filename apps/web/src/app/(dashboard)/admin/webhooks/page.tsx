"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Spinner from "@bytesend/ui/src/spinner";
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
import { isCloud } from "~/utils/common";
import { WebhookStatusBadge } from "../../webhooks/webhook-status-badge";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AdminWebhook = NonNullable<RouterOutputs["admin"]["listAdminWebhooks"]>["webhooks"][number];

export default function AdminWebhooksPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const webhooksQuery = api.admin.listAdminWebhooks.useQuery(
    { page, pageSize: 20, query: query || undefined },
    { placeholderData: (prev) => prev },
  );

  if (!isCloud()) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        Webhook administration is available only in the cloud deployment.
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader title="Webhooks" description="Customer webhook endpoints and their delivery health" />
      <SearchInput
        onSearch={(value) => {
          setPage(1);
          setQuery(value);
        }}
        placeholder="Filter by URL, team, or creator email"
        label="Search webhooks"
        className="sm:max-w-md"
      />

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Webhook</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Failures</TableHead>
              <TableHead>Last success</TableHead>
              <TableHead className="rounded-tr-xl">Last failure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooksQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  <Spinner className="mx-auto h-6 w-6" innerSvgClass="stroke-primary" />
                </TableCell>
              </TableRow>
            ) : webhooksQuery.isError ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center text-destructive">
                  Failed to load webhooks.
                </TableCell>
              </TableRow>
            ) : !webhooksQuery.data?.webhooks.length ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  No webhooks found.
                </TableCell>
              </TableRow>
            ) : (
              webhooksQuery.data.webhooks.map((webhook: AdminWebhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="max-w-[280px]">
                    <div>
                      <p className="truncate font-medium">{webhook.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {webhook.createdBy?.email ?? "Unknown creator"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Link href={`/admin/teams/${webhook.team.id}`} className="font-medium hover:underline">{webhook.team.name}</Link>
                      <p className="text-xs text-muted-foreground">{webhook.team.plan}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <WebhookStatusBadge status={webhook.status} />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] text-xs text-muted-foreground">
                      {webhook.eventTypes.slice(0, 3).join(", ")}
                      {webhook.eventTypes.length > 3 ? ` +${webhook.eventTypes.length - 3}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {webhook.consecutiveFailures}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {webhook.lastSuccessAt
                      ? formatDistanceToNow(new Date(webhook.lastSuccessAt), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {webhook.lastFailureAt
                      ? formatDistanceToNow(new Date(webhook.lastFailureAt), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {webhooksQuery.data ? (
        <Pagination page={page} pageSize={20} total={webhooksQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}