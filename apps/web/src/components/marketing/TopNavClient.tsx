"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@bytesend/ui/src/button";
import { Menu, X } from "lucide-react";

export function TopNavClient({ isCloud }: { isCloud?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const ctaHref = session ? "/dashboard" : "/login";
  const ctaLabel = session ? "Dashboard" : "Get started";

  return (
    <>
      {/* Desktop CTA */}
      <Button size="sm" className="ml-2 rounded-lg hidden sm:inline-flex" asChild>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>

      {/* Mobile hamburger */}
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="sm:hidden p-1.5 rounded-lg hover:bg-accent"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden fixed top-13.25 inset-x-0 z-50 border-t border-border/40 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col gap-1 text-sm">
            {isCloud && <Link href="/#features" className="py-2.5 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Features</Link>}
            {isCloud && <Link href="/#pricing" className="py-2.5 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Pricing</Link>}
            {isCloud && <Link href="/changelog" className="py-2.5 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Changelog</Link>}
            <a href="https://discord.gg/C2Q4GHXKQA" target="_blank" rel="noopener noreferrer" className="py-2.5 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Discord</a>
            <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer" className="py-2.5 hover:text-primary transition-colors" onClick={() => setOpen(false)}>Docs</a>
            <Button className="w-full mt-2 rounded-lg" asChild>
              <Link href={ctaHref} onClick={() => setOpen(false)}>{ctaLabel}</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
