import Link from "next/link";
import { FaDiscord, FaGithub, FaXTwitter } from "react-icons/fa6";
import { SiBluesky } from "react-icons/si";
import { env } from "~/env";
import { BrandMark } from "~/lib/brand";

const isCloud = env.NEXT_PUBLIC_IS_CLOUD;

type FooterLink = { label: string; href: string; cloudOnly?: boolean };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features", cloudOnly: true },
      { label: "Pricing", href: "/#pricing", cloudOnly: true },
      { label: "Changelog", href: "/changelog", cloudOnly: true },
      { label: "Live stats", href: "/stats", cloudOnly: true },
      { label: "Status", href: "https://status.bytesend.cloud", cloudOnly: true },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "https://docs.bytesend.cloud" },
      { label: "API reference", href: "https://docs.bytesend.cloud/api-reference/introduction" },
      { label: "Self-hosting", href: "https://docs.bytesend.cloud/self-hosting/overview" },
      { label: "GitHub", href: "https://github.com/ByteSendApp/ByteSend" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Discord", href: "https://discord.gg/C2Q4GHXKQA" },
      { label: "Legal", href: "/legal", cloudOnly: true },
      { label: "Privacy", href: "/privacy", cloudOnly: true },
      { label: "Terms", href: "/terms", cloudOnly: true },
    ],
  },
];

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/ByteSendApp/ByteSend", Icon: FaGithub },
  { label: "Discord", href: "https://discord.gg/C2Q4GHXKQA", Icon: FaDiscord },
  { label: "X", href: "https://x.com/TryByteSend", Icon: FaXTwitter },
  { label: "Bluesky", href: "https://bsky.app/profile/bytesend.cloud", Icon: SiBluesky },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  const className = "block truncate text-[13px] text-muted-foreground transition-colors hover:text-foreground";
  return link.href.startsWith("http") ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
      {link.label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <BrandMark size={15} />
              <span className="text-sm font-semibold text-foreground">ByteSend</span>
            </Link>
            <p className="max-w-xs text-[13px] text-muted-foreground">Open-source email infrastructure for transactional and marketing email.</p>
            <div className="flex gap-1">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {COLUMNS.map((column) => (
              <div key={column.title} className="min-w-0">
                <p className="mb-3 text-xs font-medium text-foreground">{column.title}</p>
                <ul className="space-y-2">
                  {column.links
                    .filter((link) => isCloud || !link.cloudOnly)
                    .map((link) => (
                      <li key={link.label}>
                        <FooterAnchor link={link} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} NodeByte LTD · Registered in England and Wales</span>
          <span>Made in the UK & Canada</span>
        </div>
      </div>
    </footer>
  );
}
