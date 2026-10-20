import { CampaignStatus } from "@prisma/client";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";

const STATUS: Record<CampaignStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [CampaignStatus.DRAFT]: { label: "Draft", variant: "neutral" },
  [CampaignStatus.SCHEDULED]: { label: "Scheduled", variant: "info" },
  [CampaignStatus.RUNNING]: { label: "Sending", variant: "brand" },
  [CampaignStatus.PAUSED]: { label: "Paused", variant: "warning" },
  [CampaignStatus.SENT]: { label: "Sent", variant: "success" },
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, variant } = STATUS[status] ?? STATUS[CampaignStatus.DRAFT];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
