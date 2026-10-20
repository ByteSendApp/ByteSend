import type { ReactNode } from "react";
import { cn } from "@bytesend/ui/lib/utils";
import { Reveal } from "./Reveal";

/** A full-width band of the marketing site with the shared container and vertical rhythm. */
export function Section({
  id,
  children,
  className,
  tinted = false,
  bordered = true,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** A faint background, to separate neighbouring sections. */
  tinted?: boolean;
  bordered?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-20 sm:py-24", bordered && "border-t border-border", tinted && "bg-muted/30", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl sm:mb-12", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
      <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p> : null}
    </Reveal>
  );
}

/** Cells separated by hairlines, like the dashboard's stat strips. */
export function HairlineGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-lg border border-border bg-border [&>*]:bg-background", className)}>
      {children}
    </div>
  );
}
