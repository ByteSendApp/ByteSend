"use client";

import { CampaignStatus } from "@prisma/client";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@bytesend/ui/src/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@bytesend/ui/src/tooltip";
import DeleteCampaign from "./delete-campaign";
import DuplicateCampaign from "./duplicate-campaign";
import TogglePauseCampaign from "./toggle-pause-campaign";
import CampaignStatusBadge from "./campaign-status-badge";

interface CampaignRowProps {
  campaign: {
    id: string;
    name: string;
    subject: string;
    from: string;
    status: CampaignStatus;
    intent: "CAMPAIGN" | "BROADCAST";
    createdAt: Date;
    updatedAt: Date;
    scheduledAt?: Date | null;
    total: number;
    sent: number;
    delivered: number;
    unsubscribed: number;
  };
  basePath: "/campaigns" | "/broadcasts";
}

function hrefFor(campaign: CampaignRowProps["campaign"], basePath: string) {
  const editable = campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.SCHEDULED;
  if (!editable) return `${basePath}/${campaign.id}`;
  return campaign.intent === "BROADCAST" ? `${basePath}/${campaign.id}/compose` : `${basePath}/${campaign.id}/edit`;
}

function Progress({ campaign }: { campaign: CampaignRowProps["campaign"] }) {
  const { status, total, sent, delivered, unsubscribed, scheduledAt } = campaign;
  if (status === CampaignStatus.SCHEDULED && scheduledAt) {
    return <span className="text-muted-foreground">Sends {format(new Date(scheduledAt), "MMM d 'at' HH:mm")}</span>;
  }
  if (status === CampaignStatus.SENT) {
    return (
      <span className="text-muted-foreground">
        <span className="tabular-nums text-foreground">{delivered.toLocaleString()}</span> delivered
        {unsubscribed > 0 ? <> · {unsubscribed.toLocaleString()} unsubscribed</> : null}
      </span>
    );
  }
  if ((status === CampaignStatus.RUNNING || status === CampaignStatus.PAUSED) && total > 0) {
    const pct = Math.round((sent / total) * 100);
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums text-muted-foreground">
          {sent.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
    );
  }
  return <span className="text-muted-foreground">Not sent yet</span>;
}

function ActionTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function CampaignRow({ campaign, basePath }: CampaignRowProps) {
  const router = useRouter();
  const href = hrefFor(campaign, basePath);
  const canPause =
    campaign.status === CampaignStatus.SCHEDULED || campaign.status === CampaignStatus.RUNNING || campaign.status === CampaignStatus.PAUSED;

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="max-w-0">
        <Link href={href} className="block truncate font-medium text-foreground" onClick={(e) => e.stopPropagation()}>
          {campaign.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{campaign.subject || "No subject yet"}</p>
      </TableCell>
      <TableCell>
        <CampaignStatusBadge status={campaign.status} />
      </TableCell>
      <TableCell className="hidden text-xs md:table-cell">
        <Progress campaign={campaign} />
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {formatDistanceToNow(campaign.updatedAt, { addSuffix: true })}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <TooltipProvider>
          <div className="flex justify-end gap-1">
            {canPause ? (
              <ActionTip label={campaign.status === CampaignStatus.PAUSED ? "Resume" : "Pause"}>
                <TogglePauseCampaign campaign={campaign} />
              </ActionTip>
            ) : null}
            <ActionTip label="Duplicate">
              <DuplicateCampaign campaign={campaign} />
            </ActionTip>
            <ActionTip label="Delete">
              <DeleteCampaign campaign={campaign} />
            </ActionTip>
          </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}
