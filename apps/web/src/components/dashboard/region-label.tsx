import { REGION_INFO } from "~/lib/constants/regions";

// Flag emoji don't render on Windows (they show as letters), so the country is a small code chip instead.
export function RegionLabel({ region, full = false }: { region: string; full?: boolean }) {
  const info = REGION_INFO[region];
  if (!info) return <span className="font-mono text-xs">{region}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle" title={`${info.label} · ${region}`}>
      <span
        aria-hidden
        className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] border border-border bg-muted px-1 font-mono text-[9px] font-medium uppercase leading-none tracking-wide text-muted-foreground"
      >
        {info.country}
      </span>
      <span>{full ? info.label : info.short}</span>
    </span>
  );
}
