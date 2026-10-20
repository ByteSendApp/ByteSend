import { Globe, HouseIcon, LayoutTemplate, Mail, Search, UserRoundX, Webhook } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { BrandIcon } from "~/lib/brand";

// Deterministic sample data, so the server and client render the same thing.
const DAYS = Array.from({ length: 30 }, (_, i) => {
  const base = 380 + Math.round(Math.sin(i / 3.2) * 90 + (i % 7 === 5 || i % 7 === 6 ? -140 : 40) + i * 9);
  return { delivered: base, opened: Math.round(base * 0.42), bounced: Math.round(base * 0.006) + (i % 9 === 0 ? 3 : 0) };
});
const MAX = Math.max(...DAYS.map((d) => d.delivered + d.opened));

const NAV = [
  { icon: HouseIcon, label: "Overview", active: true },
  { icon: Mail, label: "Emails" },
  { icon: Globe, label: "Domains" },
  { icon: LayoutTemplate, label: "Templates" },
  { icon: UserRoundX, label: "Suppressions" },
  { icon: Webhook, label: "Webhooks" },
];

const DOMAINS = [
  { name: "mail.acme.com", region: "US East", sent: "48,210" },
  { name: "acme.co.uk", region: "London", sent: "12,904" },
  { name: "news.acme.com", region: "Frankfurt", sent: "9,377" },
];

/**
 * A scaled-down copy of the dashboard Overview built from the real components, so the home page
 * always shows the current product instead of a screenshot that goes stale.
 */
export function ProductPreview() {
  return (
    <div
      aria-label="Preview of the ByteSend dashboard"
      role="img"
      className="pointer-events-none select-none overflow-hidden rounded-xl border border-border bg-background text-left shadow-[0_40px_120px_-40px_rgba(0,87,255,0.45)]"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 rounded bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">bytesend.cloud/dashboard</span>
      </div>

      <div className="flex">
        <aside className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-sidebar p-2 md:flex">
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
            <span className="flex size-6 items-center justify-center rounded-md border border-border bg-muted/60">
              <BrandIcon size={14} />
            </span>
            <span className="text-[12px] font-semibold text-foreground">Acme</span>
          </div>
          {NAV.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                item.active ? "bg-sidebar-accent font-medium text-foreground" : "text-sidebar-foreground/80"
              }`}
            >
              <item.icon className={`size-3.5 ${item.active ? "text-primary" : "text-sidebar-foreground/60"}`} />
              {item.label}
            </div>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex h-10 items-center justify-between border-b border-border px-4">
            <span className="text-[12px] font-medium text-foreground">Overview</span>
            <span className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              <Search className="size-3" /> Search
            </span>
          </div>

          <div className="space-y-3 p-4">
            <StatGroup className="[&_.text-xl]:text-base">
              <Stat label="Sent · 30 days" value="70,491" trend={DAYS.map((d) => d.delivered)} />
              <Stat label="Delivered" value="99.4%" />
              <Stat label="Bounced" value="0.41%" />
              <Stat label="Opened" value="42.8%" />
            </StatGroup>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                <span className="text-[12px] font-semibold text-foreground">Activity</span>
                <span className="flex gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-[2px] bg-primary" /> Delivered
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-[2px] bg-purple" /> Opened
                  </span>
                </span>
              </div>
              <div className="flex h-28 items-end gap-[3px] px-3 pb-3 pt-4 sm:h-36">
                {DAYS.map((day, i) => (
                  <div key={i} className="flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
                    <div className="rounded-t-[2px] bg-purple/80" style={{ height: `${(day.opened / MAX) * 100}%` }} />
                    <div className="bg-primary" style={{ height: `${(day.delivered / MAX) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
              {DOMAINS.map((domain) => (
                <div key={domain.name} className="flex items-center justify-between border-b border-border/70 px-3 py-2 text-[12px] last:border-0">
                  <span className="font-medium text-foreground">{domain.name}</span>
                  <span className="flex items-center gap-4 text-muted-foreground">
                    <span className="hidden lg:inline">{domain.region}</span>
                    <span className="tabular-nums">{domain.sent}</span>
                    <Badge variant="success" dot>
                      Verified
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
