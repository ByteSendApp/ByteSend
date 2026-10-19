import React from "react";
import { DomainStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

export const DnsStatusBadge: React.FC<{ status: DomainStatus }> = ({ status }) => {
  type BadgeConfig = { label: string; className: string; Icon: React.ElementType };
  const config: Record<DomainStatus, BadgeConfig> = {
    [DomainStatus.SUCCESS]: {
      label: "Verified",
      className: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20",
      Icon: CheckCircle2,
    },
    [DomainStatus.FAILED]: {
      label: "Failed",
      className: "text-destructive bg-destructive/10 border-destructive/20",
      Icon: XCircle,
    },
    [DomainStatus.PENDING]: {
      label: "Pending",
      className: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      Icon: Clock,
    },
    [DomainStatus.TEMPORARY_FAILURE]: {
      label: "Temp failure",
      className: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      Icon: AlertTriangle,
    },
    [DomainStatus.NOT_STARTED]: {
      label: "Not set up",
      className: "text-muted-foreground bg-muted border-border/40",
      Icon: Clock,
    },
  };

  const { label, className, Icon } = config[status] ?? config[DomainStatus.NOT_STARTED];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
