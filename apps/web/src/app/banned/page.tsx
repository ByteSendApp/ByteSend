import Image from "next/image";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { FaDiscord } from "react-icons/fa6";

export default function BannedPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-120 w-180 rounded-full bg-destructive/8 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-destructive/5 blur-[100px]" />

      <div className="relative w-full max-w-100 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
            <ShieldOff className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Account suspended
            </h1>
            <p className="text-sm text-muted-foreground">
              Your access to ByteSend has been restricted
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-6 space-y-4">
          <div className="rounded-lg bg-destructive/8 border border-destructive/15 px-4 py-3">
            <p className="text-sm text-destructive/90">
              This account has been suspended for violating our{" "}
              <Link
                href="/acceptable-use"
                className="underline underline-offset-2 hover:text-destructive transition-colors"
              >
                Acceptable Use Policy
              </Link>
              . If you believe this is a mistake, please reach out to our team.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <Link
              href="https://discord.gg/C2Q4GHXKQA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#5865F2] px-6 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors shadow-lg shadow-[#5865F2]/20"
            >
              <FaDiscord className="h-4 w-4" />
              Appeal on Discord
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border/40 bg-card/40 px-6 text-sm font-medium text-foreground hover:bg-card/80 transition-colors backdrop-blur-sm"
            >
              Back to login
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/40">
          © {new Date().getFullYear()} NodeByte LTD
        </p>
      </div>
    </main>
  );
}
