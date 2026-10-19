const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCompact(value: number) {
  return value < 10_000 ? numberFormatter.format(value) : compactFormatter.format(value);
}

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function formatPercent(value: number, fractionDigits = 2) {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
