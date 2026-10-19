type Change = { from: unknown; to: unknown };

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value === -1 ? "unlimited" : value.toLocaleString();
  return String(value);
}

function isChangeMap(value: unknown): value is Record<string, Change> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((v) => typeof v === "object" && v !== null && "from" in v && "to" in v)
  );
}

export function AuditMetadata({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") {
    return <span className="text-muted-foreground">—</span>;
  }

  const { changes, ...rest } = metadata as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {isChangeMap(changes)
        ? Object.entries(changes).map(([field, change]) => (
            <p key={field} className="font-mono">
              <span className="text-muted-foreground">{field}</span>{" "}
              <span className="text-destructive/80 line-through decoration-destructive/40">
                {formatValue(change.from)}
              </span>{" "}
              → <span className="text-foreground">{formatValue(change.to)}</span>
            </p>
          ))
        : null}
      {Object.entries(rest).map(([key, value]) => (
        <p key={key} className="truncate font-mono" title={formatValue(value)}>
          <span className="text-muted-foreground">{key}</span> {formatValue(value)}
        </p>
      ))}
    </div>
  );
}
