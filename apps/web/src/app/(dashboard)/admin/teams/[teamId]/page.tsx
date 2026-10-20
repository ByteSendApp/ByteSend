"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import { api } from "~/trpc/react";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
  DELIVERABILITY_WINDOW_DAYS,
} from "~/lib/constants/deliverability";
import { useColors } from "../../../dashboard/hooks/useColors";
import { AuditLogTable } from "../../_components/audit-log-table";
import { BlockTeamDialog } from "../../_components/block-team-dialog";
import { RateGauge } from "../../_components/rate-gauge";
import { StatCard } from "../../_components/stat-card";
import { StatusPill, type StatusTone } from "../../_components/status-pill";
import { formatCompact, formatNumber, formatPercent, ratio } from "../../_components/format";
import { DailyBarChart } from "../../_overview/daily-bar-chart";
import { AssignPlanCard } from "../_components/assign-plan-card";
import { DeleteTeamCard } from "../_components/delete-team-card";
import { DomainRegionControl } from "../_components/domain-region-control";
import { TeamSettingsCard } from "../_components/team-settings-card";
import { toast } from "@bytesend/ui/src/toaster";
import {
  domainAgeDays,
  isInNewTeamRamp,
  NEW_TEAM_DAILY_LIMIT,
  newTeamRampEndsAt,
  YOUNG_DOMAIN_DAYS,
} from "~/lib/constants/trust";

const DOMAIN_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  SUCCESS: { label: "Verified", tone: "success" },
  PENDING: { label: "Pending", tone: "warning" },
  NOT_STARTED: { label: "Not started", tone: "muted" },
  FAILED: { label: "Failed", tone: "destructive" },
  TEMPORARY_FAILURE: { label: "Temporary failure", tone: "warning" },
};

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function TeamDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export default function AdminTeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = Number(params.teamId);
  const { data: session } = useSession();
  const canAssignPlans = Boolean(session?.user?.isAdmin);
  const colors = useColors();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const teamQuery = api.admin.getTeamDetail.useQuery(
    { teamId },
    { enabled: Number.isInteger(teamId), retry: false },
  );
  const team = teamQuery.data;
  const utils = api.useUtils();
  const approveSending = api.admin.setTeamSendingApproved.useMutation({
    onSuccess: async (updated) => {
      toast.success(updated.sendingApprovedAt ? "Sending approved: the new-team limit is lifted" : "Approval revoked");
      await Promise.all([utils.admin.getTeamDetail.invalidate({ teamId }), utils.admin.listAuditLog.invalidate()]);
    },
    onError: (error) => toast.error("Could not update approval", { description: error.message }),
  });

  const usageSeries = useMemo(
    () => [
      { key: "delivered", label: "Delivered", color: colors.delivered },
      { key: "bounced", label: "Bounced", color: colors.bounced },
      { key: "complained", label: "Complained", color: colors.complained },
    ],
    [colors],
  );

  if (teamQuery.isLoading) return <TeamDetailSkeleton />;

  if (!team) {
    return (
      <div className="space-y-4">
        <Link href="/admin/teams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Teams
        </Link>
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {teamQuery.error?.message ?? "Team not found"}
        </div>
      </div>
    );
  }

  const totals = team.usage.reduce(
    (acc, day) => ({ sent: acc.sent + day.sent, delivered: acc.delivered + day.delivered }),
    { sent: 0, delivered: 0 },
  );
  const subscription = team.subscription[0];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/admin/teams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Teams
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{team.name}</h2>
              <StatusPill tone="muted">{team.plan}</StatusPill>
              {team.isBlocked ? <StatusPill tone="destructive">Blocked</StatusPill> : null}
              {!team.isActive ? <StatusPill tone="warning">Inactive</StatusPill> : null}
              {isInNewTeamRamp(team) ? (
                <span title={`Until ${format(newTeamRampEndsAt(team), "MMM d, HH:mm")} or until approved`}>
                  <StatusPill tone="warning">New-team limit: {NEW_TEAM_DAILY_LIMIT}/day</StatusPill>
                </span>
              ) : null}
              {team.sendingApprovedAt ? <StatusPill tone="success">Sending approved</StatusPill> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">#{team.id}</span> · created{" "}
              <span title={format(team.createdAt, "yyyy-MM-dd HH:mm")}>
                {formatDistanceToNow(team.createdAt, { addSuffix: true })}
              </span>
              {team.billingEmail ? <> · billing {team.billingEmail}</> : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {team.stripeCustomerId ? (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://dashboard.stripe.com/customers/${team.stripeCustomerId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stripe <ExternalLink className="ml-1.5 size-3.5" />
                </a>
              </Button>
            ) : null}
            {isInNewTeamRamp(team) || team.sendingApprovedAt ? (
              <Button
                variant="outline"
                size="sm"
                disabled={approveSending.isPending}
                onClick={() => approveSending.mutate({ teamId: team.id, approved: !team.sendingApprovedAt })}
              >
                {team.sendingApprovedAt ? "Revoke approval" : "Approve sending"}
              </Button>
            ) : null}
            <Button
              variant={team.isBlocked ? "outline" : "destructive"}
              size="sm"
              onClick={() => setBlockDialogOpen(true)}
            >
              {team.isBlocked ? "Unblock" : "Block"}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members ({team.teamUsers.length})</TabsTrigger>
            <TabsTrigger value="domains">Domains ({team.domains.length})</TabsTrigger>
            <TabsTrigger value="integrations">API &amp; webhooks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sent (30d)"
              value={formatCompact(totals.sent)}
              trend={team.usage.map((day) => day.sent)}
            />
            <StatCard
              label="Delivery rate (30d)"
              value={formatPercent(ratio(totals.delivered, totals.sent), 1)}
              hint={`${formatNumber(totals.delivered)} delivered`}
            />
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Hard bounce ({DELIVERABILITY_WINDOW_DAYS}d)</p>
              <RateGauge
                value={team.deliverability.bounceRate}
                warn={BOUNCE_RATE_WARN_LIMIT}
                hard={BOUNCE_RATE_HARD_LIMIT}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                {formatNumber(team.deliverability.hardBounced)} of {formatNumber(team.deliverability.delivered)} · limit{" "}
                {formatPercent(BOUNCE_RATE_HARD_LIMIT, 0)}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Complaints ({DELIVERABILITY_WINDOW_DAYS}d)</p>
              <RateGauge
                value={team.deliverability.complaintRate}
                warn={COMPLAINT_RATE_WARN_LIMIT}
                hard={COMPLAINT_RATE_HARD_LIMIT}
                fractionDigits={3}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                {formatNumber(team.deliverability.complained)} complaints · limit {formatPercent(COMPLAINT_RATE_HARD_LIMIT, 1)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <DailyBarChart title="Sending (30 days)" data={team.usage} series={usageSeries} height={240} />
            <Link
              href={`/admin/emails?teamId=${team.id}`}
              className="inline-flex text-xs text-muted-foreground hover:text-foreground"
            >
              Browse this team&apos;s emails →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Contact books", value: team._count.contactBooks },
              { label: "Campaigns", value: team._count.campaigns },
              { label: "Templates", value: team._count.templates },
              { label: "Suppressed addresses", value: team._count.suppressionList },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm"
              >
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-mono text-sm font-medium tabular-nums">{formatNumber(item.value)}</span>
              </div>
            ))}
          </div>

          <Panel title="Subscription">
            {subscription ? (
              <dl className="grid gap-4 p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 capitalize">{subscription.status.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Current period ends</dt>
                  <dd className="mt-0.5">
                    {subscription.currentPeriodEnd ? format(subscription.currentPeriodEnd, "MMM d, yyyy") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Cancels</dt>
                  <dd className="mt-0.5">
                    {subscription.cancelAtPeriodEnd ? format(subscription.cancelAtPeriodEnd, "MMM d, yyyy") : "No"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Subscription ID</dt>
                  <dd className="mt-0.5 truncate font-mono text-xs">{subscription.id}</dd>
                </div>
              </dl>
            ) : (
              <EmptyRow>No Stripe subscription{team.plan !== "FREE" ? " (plan was assigned manually)" : ""}.</EmptyRow>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="members">
          <Panel title="Members">
            {team.teamUsers.length === 0 ? (
              <EmptyRow>No members.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border/60">
                {team.teamUsers.map(({ role, user }) => (
                  <li key={user.id}>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {user.isBanned ? <StatusPill tone="destructive">Banned</StatusPill> : null}
                        {user.isAdmin ? <StatusPill tone="warning">Platform admin</StatusPill> : null}
                        <StatusPill tone="muted">{role === "ADMIN" ? "Admin" : "Member"}</StatusPill>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="domains">
          <Panel title="Domains">
            {team.domains.length === 0 ? (
              <EmptyRow>No domains added.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border/60">
                {team.domains.map((domain) => {
                  const status = DOMAIN_STATUS[domain.status] ?? { label: domain.status, tone: "muted" as const };
                  return (
                    <li key={domain.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{domain.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {domain.region} · added {formatDistanceToNow(domain.createdAt, { addSuffix: true })}
                          {domain.registeredAt ? ` · registered ${formatDistanceToNow(domain.registeredAt, { addSuffix: true })}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {domain.openTracking ? <StatusPill tone="muted">Open tracking</StatusPill> : null}
                        {domain.clickTracking ? <StatusPill tone="muted">Click tracking</StatusPill> : null}
                        {domain.registeredAt && domainAgeDays(domain.registeredAt) < YOUNG_DOMAIN_DAYS ? (
                          <StatusPill tone="warning">New domain</StatusPill>
                        ) : null}
                        {!domain.dmarcAdded ? <StatusPill tone="warning">No DMARC</StatusPill> : null}
                        {domain.blacklistChecks.some((check) => check.status === "LISTED") ? (
                          <Link href="/admin/blacklists">
                            <StatusPill tone="destructive">Blacklisted</StatusPill>
                          </Link>
                        ) : null}
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        <DomainRegionControl teamId={team.id} domain={domain} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Panel title="API keys">
            {team.apiKeys.length === 0 ? (
              <EmptyRow>No API keys.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border/60">
                {team.apiKeys.map((key) => (
                  <li key={key.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {key.partialToken} · {key.permission.toLowerCase()}
                        {key.domain ? ` · ${key.domain.name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {key.lastUsed ? `Used ${formatDistanceToNow(key.lastUsed, { addSuffix: true })}` : "Never used"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Webhooks">
            {team.webhookEndpoints.length === 0 ? (
              <EmptyRow>No webhooks.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border/60">
                {team.webhookEndpoints.map((hook) => (
                  <li key={hook.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 truncate font-mono text-xs">{hook.url}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hook.consecutiveFailures > 0 ? (
                        <StatusPill tone="warning">{hook.consecutiveFailures} failures</StatusPill>
                      ) : null}
                      <StatusPill tone={hook.status === "ACTIVE" ? "success" : "muted"}>
                        {hook.status.toLowerCase()}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <TeamSettingsCard team={team} />
          {canAssignPlans ? <AssignPlanCard teamId={team.id} currentPlan={team.plan} /> : null}
          <DeleteTeamCard team={team} />
        </TabsContent>

        <TabsContent value="activity">
          <AuditLogTable
            targetType="team"
            targetId={String(team.id)}
            showTarget={false}
            pageSize={25}
            emptyLabel="No admin changes to this team yet"
          />
        </TabsContent>
      </Tabs>

      <BlockTeamDialog team={team} open={blockDialogOpen} onOpenChange={setBlockDialogOpen} />
    </div>
  );
}
