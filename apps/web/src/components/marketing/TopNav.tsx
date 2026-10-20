import Link from "next/link";
import { env } from "~/env";
import { TopNavClient } from "./TopNavClient";
import { BrandMark } from "~/lib/brand";

const isCloud = env.NEXT_PUBLIC_IS_CLOUD;

export function TopNav() {
  return (
    <header className="py-3 border-b border-border/40 fixed top-0 left-0 right-0 z-50">
      {/* Blur layer is pointer-events-none to prevent iOS Safari from intercepting touches on page content */}
      <div className="pointer-events-none absolute inset-0 bg-background/70 backdrop-blur-xl supports-backdrop-filter:bg-background/60" />
      <div className="relative mx-auto max-w-5xl px-6 flex items-center justify-between gap-4 text-sm">
        {/* Logo: server-rendered, zero client JS */}
        <Link href="/" className="flex items-center gap-2 group">
          <BrandMark size={17} />
          <span className="text-foreground font-semibold text-base group-hover:text-primary transition-colors">ByteSend</span>
        </Link>

        {/* Desktop nav links: server-rendered */}
        <nav className="hidden sm:flex items-center gap-6 text-muted-foreground">
          {isCloud && <Link href="/#features" className="hover:text-foreground transition-colors text-[13px]">Features</Link>}
          {isCloud && <Link href="/#pricing" className="hover:text-foreground transition-colors text-[13px]">Pricing</Link>}
          {isCloud && <Link href="/changelog" className="hover:text-foreground transition-colors text-[13px]">Changelog</Link>}
          <a href="https://discord.gg/C2Q4GHXKQA" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-[13px]">Discord</a>
          <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-[13px]">Docs</a>
        </nav>

        {/* Session CTA + mobile hamburger/menu: tiny client island */}
        <TopNavClient isCloud={!!isCloud} />
      </div>
    </header>
  );
}
