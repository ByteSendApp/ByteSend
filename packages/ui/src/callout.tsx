import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

const TONES = {
  info: { box: "border-primary/25 bg-primary/[0.06]", icon: "text-primary", Icon: Info },
  success: { box: "border-success/25 bg-success/[0.06]", icon: "text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning/[0.07]", icon: "text-warning", Icon: AlertTriangle },
  danger: { box: "border-destructive/30 bg-destructive/[0.06]", icon: "text-destructive", Icon: XCircle },
} as const;

export interface CalloutProps {
  tone?: keyof typeof TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** An inline message about the current page: something to fix, a warning, or a tip. */
export function Callout({ tone = "info", title, children, action, className }: CalloutProps) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3", box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1 space-y-1 text-[13px]">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        {children ? <div className="text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_strong]:text-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
