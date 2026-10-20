import { EmailStatus } from "@prisma/client";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";

const VARIANT: Partial<Record<EmailStatus, BadgeProps["variant"]>> = {
  DELIVERED: "success",
  OPENED: "info",
  CLICKED: "brand",
  BOUNCED: "danger",
  FAILED: "danger",
  REJECTED: "danger",
  RENDERING_FAILURE: "danger",
  HELD: "warning",
  COMPLAINED: "warning",
  DELIVERY_DELAYED: "warning",
};

export const EmailStatusBadge: React.FC<{ status: EmailStatus }> = ({ status }) => (
  <Badge variant={VARIANT[status] ?? "neutral"} dot className="capitalize">
    {status.toLowerCase().split("_").join(" ")}
  </Badge>
);

export const EmailStatusIcon: React.FC<{ status: EmailStatus }> = ({
  status,
}) => {
  let outsideColor = "bg-muted-foreground/20";
  let insideColor = "bg-muted-foreground";

  switch (status) {
    case "DELIVERED":
      outsideColor = "bg-green/25";
      insideColor = "bg-green";
      break;
    case "BOUNCED":
    case "FAILED":
      outsideColor = "bg-red/25";
      insideColor = "bg-red";
      break;
    case "CLICKED":
      outsideColor = "bg-blue/25";
      insideColor = "bg-blue";
      break;
    case "OPENED":
      outsideColor = "bg-primary/20";
      insideColor = "bg-primary";
      break;
    case "DELIVERY_DELAYED":
    case "COMPLAINED":
      outsideColor = "bg-yellow/25";
      insideColor = "bg-yellow";
      break;
    default:
      break;
  }

  return (
    <div
      className={`flex justify-center items-center p-1.5 ${outsideColor} rounded-full`}
    >
      <div className={`h-2 w-2 rounded-full ${insideColor}`} />
    </div>
  );
};
