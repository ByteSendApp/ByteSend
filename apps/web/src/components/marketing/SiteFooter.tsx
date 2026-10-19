import Image from "next/image";
import Link from "next/link";
import { FaDiscord, FaGithub, FaXTwitter } from "react-icons/fa6";
import { SiBluesky } from "react-icons/si";
import { env } from "~/env";

const isCloud = env.NEXT_PUBLIC_IS_CLOUD;

export function SiteFooter() {
  return (
    <footer className="bg-background border-t border-border/30">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Left: brand + links */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <Image src="/logo-squircle.png" alt="ByteSend" width={22} height={22} />
              <span className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors">ByteSend</span>
            </Link>
            <nav className="flex items-center gap-4 text-[13px] text-muted-foreground">
              <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
              {isCloud && <Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link>}
              {isCloud && <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>}
              {isCloud && <a href="https://status.bytesend.cloud" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Status</a>}
            </nav>
          </div>

          {/* Right: social icons */}
          <div className="flex items-center gap-3">
            <a href="https://github.com/NodeByteLTD/ByteSend" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
              <FaGithub className="size-4.5" />
            </a>
            <a href="https://discord.gg/C2Q4GHXKQA" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Discord">
              <FaDiscord className="size-4.5" />
            </a>
            <a href="https://x.com/TryByteSend" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="X (Twitter)">
              <FaXTwitter className="size-4" />
            </a>
            <a href="https://bsky.app/profile/bytesend.cloud" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Bluesky">
              <SiBluesky className="size-4" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/20 text-center text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} NodeByte LTD · Registered in England and Wales
        </div>
      </div>
    </footer>
  );
}
