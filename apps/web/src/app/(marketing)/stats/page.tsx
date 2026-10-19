import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "~/components/marketing/Reveal";
import { PublicStatsService, type PublicStatsDay } from "~/server/service/public-stats-service";
import { isCloud } from "~/utils/common";

// Reads the database at request time; the numbers themselves are cached for an hour.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open stats – ByteSend",
  description: "Live, aggregate numbers from ByteSend: emails sent, delivery rate, deliverability health and uptime.",
  alternates: { canonical: "https://bytesend.cloud/stats" },
};

const BOUNCE_THRESHOLD = 0.05;
const COMPLAINT_THRESHOLD = 0.001;

const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-GB");

function rate(part: number, total: number) {
  return total > 0 ? part / total : null;
}

function formatPercent(value: number | null, digits = 1) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function StatTile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
      <div className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

function VolumeChart({ days }: { days: PublicStatsDay[] }) {
  const max = Math.max(1, ...days.map((day) => day.sent));
  const width = 600;
  const height = 160;
  const gap = 4;
  const barWidth = (width - gap * (days.length - 1)) / days.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Emails sent per day over the last 30 days">
      <defs>
        <linearGradient id="stats-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1fb5ff" />
          <stop offset="100%" stopColor="#0057ff" />
        </linearGradient>
      </defs>
      {days.map((day, index) => {
        const barHeight = day.sent === 0 ? 2 : Math.max(3, (day.sent / max) * height);
        return (
          <rect
            key={day.date}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={day.sent === 0 ? "currentColor" : "url(#stats-bar)"}
            className={day.sent === 0 ? "text-border" : undefined}
          >
            <title>{`${formatDay(day.date)}: ${full.format(day.sent)} sent`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function HealthRow({ label, value, threshold, description }: { label: string; value: number | null; threshold: number; description: string }) {
  const ratio = value === null ? 0 : Math.min(1, value / threshold);
  const healthy = value === null || value < threshold / 2;

  return (
    <div className="py-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm tabular-nums">
          <span className={healthy ? "text-foreground" : "text-amber-500"}>{formatPercent(value, 2)}</span>
          <span className="text-muted-foreground"> / {formatPercent(threshold, threshold < 0.01 ? 1 : 0)} AWS limit</span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${healthy ? "bg-[#00c3d6]" : "bg-amber-500"}`} style={{ width: `${Math.max(ratio * 100, value ? 1 : 0)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function StatsPage() {
  if (!isCloud()) notFound();

  const stats = await PublicStatsService.get();
  const { window } = stats;
  const updated = new Date(stats.generatedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/30">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Updated hourly · last refresh {updated} UTC
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Open stats</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Live, aggregate numbers across every team on ByteSend Cloud. No customer data, just how the platform is doing.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal delay={0}>
            <StatTile value={compact.format(stats.allTime.sent)} label="Emails sent, all time" hint={full.format(stats.allTime.sent)} />
          </Reveal>
          <Reveal delay={80}>
            <StatTile value={compact.format(window.sent)} label={`Emails sent, last ${window.days} days`} hint={full.format(window.sent)} />
          </Reveal>
          <Reveal delay={160}>
            <StatTile value={formatPercent(rate(window.delivered, window.sent))} label="Delivery rate" hint={`Last ${window.days} days`} />
          </Reveal>
          <Reveal delay={240}>
            <StatTile
              value={stats.uptime === null ? "—" : `${stats.uptime.toFixed(2)}%`}
              label="Platform uptime"
              hint={`Last 30 days, from status.bytesend.cloud`}
            />
          </Reveal>
        </section>

        <Reveal>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Daily volume</h2>
            <span className="text-xs text-muted-foreground">Emails sent per day, last {window.days} days (UTC)</span>
          </div>
          <div className="mt-6 rounded-2xl border border-border/50 bg-muted/20 p-6">
            <VolumeChart days={stats.daily} />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>{formatDay(stats.daily[0]!.date)}</span>
              <span>{formatDay(stats.daily[stats.daily.length - 1]!.date)}</span>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <Reveal>
            <h2 className="text-lg font-semibold tracking-tight">Deliverability health</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared sending reputation stays healthy because we keep the whole platform well under AWS SES limits.
            </p>
            <div className="mt-4 divide-y divide-border/40">
              <HealthRow
                label="Bounce rate"
                value={rate(window.bounced, window.sent)}
                threshold={BOUNCE_THRESHOLD}
                description="Share of sent emails that bounced. AWS reviews accounts above 5%."
              />
              <HealthRow
                label="Complaint rate"
                value={rate(window.complained, window.sent)}
                threshold={COMPLAINT_THRESHOLD}
                description="Share of sent emails marked as spam. AWS reviews accounts above 0.1%."
              />
            </div>
          </Reveal>

          <Reveal>
            <h2 className="text-lg font-semibold tracking-tight">Sending regions</h2>
            <p className="mt-1 text-sm text-muted-foreground">AWS SES regions your domains can send from.</p>
            <ul className="mt-6 space-y-2">
              {stats.regions.map((region) => (
                <li key={region.code} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                  <span className="text-sm">{region.label}</span>
                  <code className="font-mono text-xs text-muted-foreground">{region.code}</code>
                </li>
              ))}
            </ul>
            <Link
              href="https://status.bytesend.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Live region status →
            </Link>
          </Reveal>
        </div>

        <p className="border-t border-border/30 pt-8 text-xs leading-relaxed text-muted-foreground">
          Figures combine transactional and marketing email across all ByteSend Cloud teams. Self-hosted instances are not
          included. Rates are calculated against emails sent in the window; days are in UTC.
        </p>
      </div>
    </main>
  );
}
