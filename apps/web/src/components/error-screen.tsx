import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "~/lib/brand";

/** Full-page screen for 404s and crashes outside the dashboard shell. */
export function ErrorScreen({
  code,
  title,
  description,
  actions,
  detail,
}: {
  code: string;
  title: string;
  description: ReactNode;
  actions: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-4">
      <header className="mx-auto flex w-full max-w-5xl items-center py-5">
        <Link href="/" aria-label="ByteSend home" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <BrandMark size={18} />
          ByteSend
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-md text-center">
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground">{code}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
          {detail ? <div className="mt-6">{detail}</div> : null}
          <p className="mt-10 text-xs text-muted-foreground">
            Stuck?{" "}
            <a href="https://status.bytesend.cloud" className="underline underline-offset-2 hover:text-foreground">
              Check service status
            </a>{" "}
            or{" "}
            <a href="https://discord.gg/C2Q4GHXKQA" className="underline underline-offset-2 hover:text-foreground">
              ask on Discord
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

/** Shows the error reference so people can quote it to support. */
export function ErrorReference({ digest }: { digest?: string }) {
  if (!digest) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
      Reference <code className="font-mono text-foreground">{digest}</code>
    </p>
  );
}
