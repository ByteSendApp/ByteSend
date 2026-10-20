import * as React from "react";
import { cn } from "../lib/utils";

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned controls in the header, e.g. a link or a small button. */
  actions?: React.ReactNode;
  /** Removes body padding, for tables and lists that run edge to edge. */
  flush?: boolean;
  /** Sits under the body, e.g. a save bar or pagination. */
  footer?: React.ReactNode;
  tone?: "default" | "danger";
}

/** A titled section of a page. Tables and lists inside a flush panel run edge to edge. */
export function Panel({ title, description, actions, flush, footer, tone = "default", className, children, ...props }: PanelProps) {
  const hasHeader = title || description || actions;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground",
        tone === "danger" ? "border-destructive/30" : "border-border",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h2 className={cn("text-sm font-semibold tracking-tight", tone === "danger" && "text-destructive")}>{title}</h2>
            ) : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(!flush && "p-4")}>{children}</div>
      {footer ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-2.5">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** A setting with its explanation on the left and its control on the right. Stack several in a flush Panel. */
export function SettingRow({
  title,
  description,
  control,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Label and value rows, for detail pages. */
export function KeyValueList({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border/70", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-start justify-between gap-4 px-4 py-2.5 text-[13px]">
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
