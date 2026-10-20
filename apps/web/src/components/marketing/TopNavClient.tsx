"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";

export function TopNavClient({ links }: { links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {session ? (
          <Button size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <div className="fixed inset-x-0 top-14 z-50 border-b border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3 text-[15px]">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="border-b border-border/60 py-3 text-foreground last:border-0" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {session ? (
                <Button className="col-span-2" asChild>
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/login" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup" onClick={() => setOpen(false)}>
                      Start free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
