import type { ReactNode } from "react";
import { CheckCircle2, MailCheck, MailX, XCircle } from "lucide-react";

const TONES = {
  success: { Icon: CheckCircle2, className: "text-success bg-success/10" },
  pending: { Icon: MailCheck, className: "text-primary bg-primary/10" },
  removed: { Icon: MailX, className: "text-muted-foreground bg-muted" },
  error: { Icon: XCircle, className: "text-destructive bg-destructive/10" },
} as const;

/**
 * For pages a sender's recipients see (unsubscribe, confirm subscription). Deliberately plain and
 * unbranded apart from a small credit, since recipients don't know or care what ByteSend is.
 */
export function RecipientPage({
  tone,
  title,
  children,
  action,
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { Icon, className } = TONES[tone];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <div className={`mx-auto flex size-11 items-center justify-center rounded-full ${className}`}>
          <Icon className="size-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {children ? <div className="mt-1.5 text-sm text-muted-foreground">{children}</div> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Sent with{" "}
        <a href="https://bytesend.cloud" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-foreground">
          ByteSend
        </a>
      </p>
    </main>
  );
}
