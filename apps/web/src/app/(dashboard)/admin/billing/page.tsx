"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import Spinner from "@bytesend/ui/src/spinner";
import { Badge } from "@bytesend/ui/src/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bytesend/ui/src/card";
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
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AdminBillingTeam = NonNullable<RouterOutputs["admin"]["listAdminBilling"]>["teams"][number];

export default function AdminBillingPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const billingQuery = api.admin.listAdminBilling.useQuery(
    { page, pageSize: 20, query: query || undefined },
    { placeholderData: (prev) => prev },
  );

  const teams = billingQuery.data?.teams ?? [];
  const summary = useMemo(() => {
    return teams.reduce(
      (acc, team) => {
        const subscription = team.subscription[0] ?? null;
        if (team.plan === "FREE") acc.free += 1;
        else acc.paid += 1;
        if (subscription?.cancelAtPeriodEnd) acc.cancelling += 1;
        if (!subscription) acc.noSubscription += 1;
        return acc;
      },
      { free: 0, paid: 0, cancelling: 0, noSubscription: 0 },
    );
  }, [teams]);

  if (!isCloud()) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        Billing administration is available only in the cloud deployment.
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader title="Billing" description="Plans, Stripe customers and subscription state per team" />
      <SearchInput
        onSearch={(value) => {
          setPage(1);
          setQuery(value);
        }}
        placeholder="Filter by team, billing email, customer, or subscription"
        label="Search billing"
        className="sm:max-w-md"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Paid teams" value={summary.paid} />
        <SummaryCard label="Free teams" value={summary.free} />
        <SummaryCard label="Cancelling" value={summary.cancelling} />
        <SummaryCard label="No subscription" value={summary.noSubscription} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="rounded-tl-xl">Team</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Billing email</TableHead>
              <TableHead>Stripe customer</TableHead>
              <TableHead>Period end</TableHead>
              <TableHead className="rounded-tr-xl">State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {billingQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  <Spinner className="mx-auto h-6 w-6" innerSvgClass="stroke-primary" />
                </TableCell>
              </TableRow>
            ) : billingQuery.isError ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center text-destructive">
                  Failed to load billing data.
                </TableCell>
              </TableRow>
            ) : !billingQuery.data?.teams.length ? (
              <TableRow className="h-32">
                <TableCell colSpan={7} className="py-4 text-center">
                  No billing records found.
                </TableCell>
              </TableRow>
            ) : (
              billingQuery.data.teams.map((team: AdminBillingTeam) => {
                const subscription = team.subscription[0] ?? null;

                return (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div>
                        <Link href={`/admin/teams/${team.id}`} className="font-medium hover:underline">{team.name}</Link>
                        <p className="text-xs text-muted-foreground">ID #{team.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{team.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      {subscription ? (
                        <div>
                          <p className="font-medium">{subscription.status}</p>
                          <p className="text-xs text-muted-foreground">{subscription.id}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No subscription</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.billingEmail ?? "Not set"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.stripeCustomerId ?? "Not set"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {subscription?.currentPeriodEnd
                        ? format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={team.isBlocked ? "destructive" : "outline"}>
                          {team.isBlocked ? "Blocked" : team.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {subscription?.cancelAtPeriodEnd ? <Badge variant="secondary">Cancelling</Badge> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {billingQuery.data ? (
        <Pagination page={page} pageSize={20} total={billingQuery.data.total} onPageChange={setPage} />
      ) : null}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}