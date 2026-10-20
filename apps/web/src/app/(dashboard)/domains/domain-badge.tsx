import { DomainStatus } from "@prisma/client";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";

const STATUS: Record<DomainStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [DomainStatus.SUCCESS]: { label: "Verified", variant: "success" },
  [DomainStatus.FAILED]: { label: "Failed", variant: "danger" },
  [DomainStatus.PENDING]: { label: "Pending", variant: "warning" },
  [DomainStatus.TEMPORARY_FAILURE]: { label: "Degraded", variant: "warning" },
  [DomainStatus.NOT_STARTED]: { label: "Not set up", variant: "neutral" },
};

export const DomainStatusBadge: React.FC<{ status: DomainStatus }> = ({ status }) => {
  const { label, variant } = STATUS[status] ?? STATUS[DomainStatus.NOT_STARTED];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
};
