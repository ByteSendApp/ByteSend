"use client";

import Link from "next/link";
import { Megaphone, Pencil } from "lucide-react";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { KeyValueList, Panel } from "@bytesend/ui/src/panel";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { useBreadcrumb } from "~/components/dashboard/breadcrumbs";

import Spinner from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { use } from "react";
import { CampaignStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import TogglePauseCampaign from "../toggle-pause-campaign";
import CampaignStatusBadge from "../../campaigns/campaign-status-badge";
import { Button } from "@bytesend/ui/src/button";
import { EmailStatusBadge } from "../../emails/email-status-badge";

export default function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);

  const { data: campaign, isLoading } = api.campaign.getCampaign.useQuery(
    { campaignId: campaignId },
    {
      refetchInterval: (query) => {
        const c: any = query.state.data;
        if (!c) return false;

        if (
          c.status === CampaignStatus.RUNNING ||
          c.status === CampaignStatus.PAUSED
        ) {
          return 5000;
        }
        return false;
      },
    }
  );

  const { data: latestEmails, isLoading: latestEmailsLoading } =
    api.campaign.latestEmails.useQuery(
      { campaignId: campaignId },
      {
        refetchInterval: 5000,
      }
    );

  useBreadcrumb(
    campaign ? `/${campaign.intent === "BROADCAST" ? "broadcasts" : "campaigns"}/${campaignId}` : "",
    campaign?.name,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!campaign) {
    return <EmptyState icon={<Megaphone />} title="Not found" description="It may have been deleted, or it belongs to another team." />;
  }

  const delivered = campaign.delivered ?? 0;
  const pct = (value: number) => (delivered > 0 ? `${((value / delivered) * 100).toFixed(1)}% of delivered` : undefined);
  const total = campaign.total ?? 0;
  const processed = campaign.sent ?? 0;
  const basePath = campaign.intent === "BROADCAST" ? "/broadcasts" : "/campaigns";
  const sending = campaign.status === CampaignStatus.RUNNING || campaign.status === CampaignStatus.PAUSED;

  return (
    <div className="space-y-5">
      <PageHeader
        title={campaign.name}
        meta={<CampaignStatusBadge status={campaign.status} />}
        description={campaign.subject || undefined}
        actions={
          campaign.status === "SCHEDULED" ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`${basePath}/${campaign.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          ) : (
            <TogglePauseCampaign campaign={campaign} mode="full" />
          )
        }
      />

      {sending && total > 0 ? (
        <Panel>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-foreground">{campaign.status === CampaignStatus.PAUSED ? "Paused" : "Sending"}</span>
            <span className="tabular-nums text-muted-foreground">
              {processed.toLocaleString()} of {total.toLocaleString()} ({Math.round((processed / total) * 100)}%)
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(processed / total) * 100}%` }} />
          </div>
        </Panel>
      ) : null}

      <StatGroup>
        <Stat label="Recipients" value={total.toLocaleString()} hint={total > 0 ? `${processed.toLocaleString()} processed` : "None yet"} />
        <Stat label="Delivered" value={delivered.toLocaleString()} />
        <Stat label="Opened" value={(campaign.opened ?? 0).toLocaleString()} hint={pct(campaign.opened ?? 0)} />
        <Stat label="Clicked" value={(campaign.clicked ?? 0).toLocaleString()} hint={pct(campaign.clicked ?? 0)} />
        <Stat label="Unsubscribed" value={(campaign.unsubscribed ?? 0).toLocaleString()} hint={pct(campaign.unsubscribed ?? 0)} />
      </StatGroup>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel flush title="Email">
          <KeyValueList
            items={[
              { label: "Subject", value: campaign.subject || "–" },
              { label: "From", value: campaign.from || "–" },
              {
                label: "Sent to",
                value: campaign.contactBookId ? (
                  <Link href={`/contacts/${campaign.contactBookId}`} className="hover:underline">
                    {campaign.contactBook?.emoji} {campaign.contactBook?.name}
                  </Link>
                ) : (
                  "–"
                ),
              },
            ]}
          />
          {campaign.html ? (
            <div className="h-[520px] border-t border-border bg-white">
              <iframe title="Email preview" className="size-full" srcDoc={campaign.html} sandbox="allow-same-origin" />
            </div>
          ) : null}
        </Panel>

        <Panel flush title="Live activity" description="Latest recipients and what happened">
          {latestEmailsLoading ? (
            <ListSkeleton rows={5} />
          ) : !latestEmails || latestEmails.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing yet. Activity shows up here as emails go out.</p>
          ) : (
            <ul className="max-h-[600px] divide-y divide-border/70 overflow-y-auto">
              {latestEmails.map((email) => {
                const timestamp =
                  email.latestStatus === "SCHEDULED" && email.scheduledAt ? new Date(email.scheduledAt) : new Date(email.updatedAt ?? email.createdAt);
                return (
                  <li key={email.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{email.to?.[0] ?? "Unknown recipient"}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(timestamp, { addSuffix: true })}</p>
                    </div>
                    <EmailStatusBadge status={email.latestStatus} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
