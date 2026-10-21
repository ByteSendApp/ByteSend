import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { CopyField } from "@bytesend/ui/src/copy-field";

export type ToolFinding = { level: "good" | "warning" | "problem"; title: string; detail: string };

const FINDING_ICON: Record<ToolFinding["level"], React.ReactNode> = {
  good: <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />,
  warning: <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />,
  problem: <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />,
};

export function ToolResultCard({
  subject,
  summary,
  badge,
  records = [],
  findings,
  suggestion,
  cta,
}: {
  subject: string;
  summary: string;
  badge: { label: string; variant: "success" | "warning" | "danger" };
  records?: Array<{ label: React.ReactNode; value: string }>;
  findings: ToolFinding[];
  suggestion?: { label: React.ReactNode; value: string } | null;
  cta: { text: React.ReactNode; label: string; href: string };
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-muted-foreground">{subject}</p>
          <p className="mt-1 text-base font-medium text-foreground">{summary}</p>
        </div>
        <Badge variant={badge.variant} dot className="self-start sm:self-auto">
          {badge.label}
        </Badge>
      </div>

      <div className="space-y-5 p-5">
        {records.map((record, index) => (
          <div key={index} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{record.label}</p>
            <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">{record.value}</p>
          </div>
        ))}

        <ul className="space-y-3">
          {findings.map((finding) => (
            <li key={finding.title} className="flex gap-3">
              <span className="mt-0.5">{FINDING_ICON[finding.level]}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{finding.title}</p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{finding.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {suggestion ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{suggestion.label}</p>
            <CopyField value={suggestion.value} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{cta.text}</p>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={cta.href}>
            {cta.label}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ToolError({ message }: { message: string }) {
  return <p className="rounded-md border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">{message}</p>;
}
