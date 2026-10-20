import Link from "next/link";
import { env } from "~/env";
import { BrandMark } from "~/lib/brand";
import { TopNavClient } from "./TopNavClient";

const isCloud = env.NEXT_PUBLIC_IS_CLOUD;

export const NAV_LINKS = [
  { href: "/#features", label: "Features", cloudOnly: true },
  { href: "/#pricing", label: "Pricing", cloudOnly: true },
  { href: "/changelog", label: "Changelog", cloudOnly: true },
  { href: "/stats", label: "Stats", cloudOnly: true },
  { href: "https://docs.bytesend.cloud", label: "Docs", cloudOnly: false },
];

export function TopNav() {
  const links = NAV_LINKS.filter((link) => isCloud || !link.cloudOnly);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border">
      {/* Blur sits on its own non-interactive layer: iOS Safari otherwise swallows taps on the page beneath. */}
      <div className="pointer-events-none absolute inset-0 bg-background/75 backdrop-blur-xl" />
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={16} />
            <span className="text-[15px] font-semibold tracking-tight text-foreground">ByteSend</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) =>
              link.href.startsWith("http") ? (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
        <TopNavClient links={links.map(({ href, label }) => ({ href, label }))} />
      </div>
    </header>
  );
}
