import { useTheme } from "@bytesend/ui";

// Recharts writes these into SVG attributes, which can't read CSS variables, so they mirror the theme tokens.
const LIGHT = {
  delivered: "#0057ff",
  bounced: "#dc2f44",
  complained: "#d98a0b",
  opened: "#7c4ddb",
  clicked: "#0a9bd8",
  xaxis: "#6b7080",
  grid: "#e6e8ee",
};

const DARK = {
  delivered: "#4f8dff",
  bounced: "#f2606f",
  complained: "#f5b74f",
  opened: "#a78bfa",
  clicked: "#38c6ff",
  xaxis: "#8b90a0",
  grid: "#1d2027",
};

export function useColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}
