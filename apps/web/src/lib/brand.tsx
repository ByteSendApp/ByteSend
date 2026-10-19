import type { CSSProperties } from "react";

export const BRAND_COLORS = {
  ice: "#85fcff",
  teal: "#00c3d6",
  sky: "#1fb5ff",
  blue: "#0057ff",
  ink: "#05070d",
  paper: "#ffffff",
} as const;

export const BRAND_NAME = "ByteSend";
export const BRAND_TAGLINE = "The email platform for modern teams";

export type BrandMarkDetail = "full" | "compact" | "glyph";

// "Speed Ribbon": nested envelope-arrows trailing left like motion lines.
// Drawn on a 120×120 grid; the artwork occupies y 24–96, so it is cropped to that band.
export const BRAND_MARK_VIEWBOX = "0 24 120 72";
export const BRAND_MARK_ASPECT = 120 / 72;

type MarkColors = { outer: string; middle: string; inner: string; flap: string };

const COLOR_TONES: MarkColors = {
  outer: BRAND_COLORS.blue,
  middle: BRAND_COLORS.sky,
  inner: BRAND_COLORS.teal,
  flap: BRAND_COLORS.ice,
};

// Below ~40px the middle ribbon and flap blur together, below ~20px only a solid silhouette reads.
export function detailForSize(size: number): BrandMarkDetail {
  if (size < 20) return "glyph";
  if (size < 40) return "compact";
  return "full";
}

export function brandMarkSvgElements(detail: BrandMarkDetail, colors: MarkColors) {
  switch (detail) {
    case "full":
      return [
        { d: "M4 30H80L110 60L80 90H4", fill: "none", stroke: colors.outer, strokeWidth: 8 },
        { d: "M18 43H74.5L91.5 60L74.5 77H18", fill: "none", stroke: colors.middle, strokeWidth: 8 },
        { d: "M32 53H67L74 60L67 67H32Z", fill: colors.inner },
        {
          d: "M32 53L50 62L67 53",
          fill: "none",
          stroke: colors.flap,
          strokeWidth: 3,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
        },
      ];
    case "compact":
      return [
        { d: "M4 30H80L110 60L80 90H4", fill: "none", stroke: colors.outer, strokeWidth: 11 },
        { d: "M30 50H70L80 60L70 70H30Z", fill: colors.inner },
      ];
    case "glyph":
      return [
        { d: "M6 26H80L114 60L80 94H6Z", fill: colors.outer },
        { d: "M32 50H70L80 60L70 70H32Z", fill: colors.flap },
      ];
  }
}

export function BrandMark({
  size,
  variant = "color",
  monoColor = BRAND_COLORS.ink,
  detail,
  style,
}: {
  size: number;
  variant?: "color" | "mono";
  monoColor?: string;
  detail?: BrandMarkDetail;
  style?: CSSProperties;
}) {
  const colors =
    variant === "mono" ? { outer: monoColor, middle: monoColor, inner: monoColor, flap: "transparent" } : COLOR_TONES;
  const elements = brandMarkSvgElements(detail ?? detailForSize(size), colors);

  return (
    <svg
      width={Math.round(size * BRAND_MARK_ASPECT)}
      height={size}
      viewBox={BRAND_MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      {elements.map((props) => (
        <path key={props.d} strokeLinejoin="miter" {...props} />
      ))}
    </svg>
  );
}

export function brandMarkSvgString({
  detail = "full",
  variant = "color",
  monoColor = BRAND_COLORS.ink,
}: {
  detail?: BrandMarkDetail;
  variant?: "color" | "mono";
  monoColor?: string;
} = {}) {
  const colors =
    variant === "mono" ? { outer: monoColor, middle: monoColor, inner: monoColor, flap: "transparent" } : COLOR_TONES;
  const paths = brandMarkSvgElements(detail, colors)
    .map((el) => {
      const attrs = [
        `d="${el.d}"`,
        `fill="${el.fill ?? "none"}"`,
        "stroke" in el && el.stroke ? `stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` : "",
        "strokeLinecap" in el && el.strokeLinecap ? `stroke-linecap="${el.strokeLinecap}"` : "",
        `stroke-linejoin="${"strokeLinejoin" in el && el.strokeLinejoin ? el.strokeLinejoin : "miter"}"`,
      ]
        .filter(Boolean)
        .join(" ");
      return `<path ${attrs}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}" width="${120 * 4}" height="${72 * 4}">${paths}</svg>`;
}
