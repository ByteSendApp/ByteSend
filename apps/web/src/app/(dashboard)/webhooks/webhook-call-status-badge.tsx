import { WebhookCallStatus } from "@prisma/client";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";

const STATUS: Record<WebhookCallStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [WebhookCallStatus.DELIVERED]: { label: "Delivered", variant: "success" },
  [WebhookCallStatus.FAILED]: { label: "Failed", variant: "danger" },
  [WebhookCallStatus.PENDING]: { label: "Pending", variant: "warning" },
  [WebhookCallStatus.IN_PROGRESS]: { label: "Sending", variant: "info" },
  [WebhookCallStatus.DISCARDED]: { label: "Discarded", variant: "neutral" },
};

export function WebhookCallStatusBadge({ status }: { status: WebhookCallStatus }) {
  const { label, variant } = STATUS[status] ?? { label: status, variant: "neutral" };
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
