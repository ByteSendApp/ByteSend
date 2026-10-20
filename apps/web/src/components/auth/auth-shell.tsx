import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { BRAND_COLORS, BrandMark } from "~/lib/brand";

const POINTS = [
  "Transactional and marketing email from one API",
  "SMTP relay, SDKs, webhooks and a visual editor",
  "Pay for what you send, with a free plan to start",
];

/** Layout for sign-in and other standalone account screens. */
export function AuthShell({
  title,
  description,
  children,
  footer,
  aside = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Shows the brand panel beside the form on wide screens. */
  aside?: boolean;
}) {
  return (
    <main className="flex min-h-dvh bg-background">
      {aside ? (
        <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex" style={{ background: BRAND_COLORS.ink }}>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <BrandMark size={18} flapColor={BRAND_COLORS.ink} />
            ByteSend
          </Link>
          <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.06]" aria-hidden>
            <BrandMark size={340} flapColor={BRAND_COLORS.ink} />
          </div>
          <div className="relative space-y-6">
            <p className="max-w-sm text-2xl font-semibold leading-snug tracking-tight text-white">The email platform for modern teams.</p>
            <ul className="space-y-2.5">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: BRAND_COLORS.sky }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/40">© {new Date().getFullYear()} NodeByte LTD</p>
        </aside>
      ) : null}

      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <Link href="/" className={`inline-flex items-center gap-2 self-start text-sm font-semibold text-foreground ${aside ? "lg:invisible" : ""}`}>
          <BrandMark size={18} />
          ByteSend
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {children}
            {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <a href="https://status.bytesend.cloud" className="hover:text-foreground">
            Status
          </a>
        </p>
      </div>
    </main>
  );
}

/** A divider with a word in the middle, e.g. "or". */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
