import { WebhookStatus } from "@prisma/client";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";

const STATUS: Record<WebhookStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [WebhookStatus.ACTIVE]: { label: "Active", variant: "success" },
  [WebhookStatus.PAUSED]: { label: "Paused", variant: "neutral" },
  [WebhookStatus.AUTO_DISABLED]: { label: "Turned off", variant: "danger" },
};

export function WebhookStatusBadge({ status }: { status: WebhookStatus }) {
  const { label, variant } = STATUS[status] ?? { label: status, variant: "neutral" };
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
