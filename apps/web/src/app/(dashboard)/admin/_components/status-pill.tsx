import type { ReactNode } from "react";
import { cn } from "@bytesend/ui/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "muted";

const toneClasses: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "border-success/25 bg-success/10 text-success", dot: "bg-success" },
  warning: { pill: "border-warning/25 bg-warning/10 text-warning", dot: "bg-warning" },
  destructive: {
    pill: "border-destructive/25 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  muted: { pill: "border-border bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground/60" },
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium",
        toneClasses[tone].pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", toneClasses[tone].dot)} />
      {children}
    </span>
  );
}
