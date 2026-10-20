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

type SvgElement = {
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

function detailForSize(size: number): BrandMarkDetail {
  if (size < 20) return "glyph";
  if (size < 40) return "compact";
  return "full";
}

function toSvgString(viewBox: string, width: number, height: number, elements: SvgElement[]) {
  const paths = elements
    .map((el) =>
      [
        `<path d="${el.d}" fill="${el.fill}"`,
        el.stroke ? ` stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` : "",
        ` stroke-linecap="round" stroke-linejoin="round"/>`,
      ].join(""),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${paths}</svg>`;
}

// Primary logo, the "Ribbon": an envelope inside a send arrow. Drawn on a 120×120 grid; the
// artwork occupies y 24–96, so it is cropped to that band.
export const BRAND_MARK_VIEWBOX = "0 24 120 72";
export const BRAND_MARK_ASPECT = 120 / 72;

type MarkColors = { arrow: string; envelope: string; flap: string };

// The flap reads as a cut through the envelope, so it should match whatever sits behind the mark.
// White suits light pages and also holds up on dark ones; pass ink for known dark tiles.
function markColors(variant: "color" | "mono", monoColor: string, flapColor: string): MarkColors {
  return variant === "mono"
    ? { arrow: monoColor, envelope: monoColor, flap: "none" }
    : { arrow: BRAND_COLORS.blue, envelope: BRAND_COLORS.sky, flap: flapColor };
}

export function brandMarkSvgElements(detail: BrandMarkDetail, colors: MarkColors): SvgElement[] {
  const flap: SvgElement[] =
    colors.flap === "none" ? [] : [{ d: "M32 50L53 62L70 51", fill: "none", stroke: colors.flap, strokeWidth: 4 }];
  switch (detail) {
    case "full":
      return [
        { d: "M9 33H77L104 60L77 87H9", fill: "none", stroke: colors.arrow, strokeWidth: 11 },
        { d: "M31 48H69L80 60L69 72H31Z", fill: colors.envelope, stroke: colors.envelope, strokeWidth: 4 },
        ...flap,
      ];
    case "compact":
      return [
        { d: "M9 33H77L104 60L77 87H9", fill: "none", stroke: colors.arrow, strokeWidth: 13 },
        { d: "M31 48H69L80 60L69 72H31Z", fill: colors.envelope, stroke: colors.envelope, strokeWidth: 6 },
      ];
    case "glyph":
      return [
        { d: "M10 34H77L103 60L77 86H10", fill: "none", stroke: colors.arrow, strokeWidth: 16 },
        { d: "M33 50H68L77 60L68 70H33Z", fill: colors.envelope, stroke: colors.envelope, strokeWidth: 8 },
      ];
  }
}

export function BrandMark({
  size,
  variant = "color",
  monoColor = BRAND_COLORS.ink,
  flapColor = BRAND_COLORS.paper,
  detail,
  style,
}: {
  size: number;
  variant?: "color" | "mono";
  monoColor?: string;
  flapColor?: string;
  detail?: BrandMarkDetail;
  style?: CSSProperties;
}) {
  const elements = brandMarkSvgElements(detail ?? detailForSize(size), markColors(variant, monoColor, flapColor));

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
        <path key={props.d} {...ROUND} {...props} />
      ))}
    </svg>
  );
}

export function brandMarkSvgString({
  detail = "full",
  variant = "color",
  monoColor = BRAND_COLORS.ink,
  flapColor = BRAND_COLORS.paper,
}: {
  detail?: BrandMarkDetail;
  variant?: "color" | "mono";
  monoColor?: string;
  flapColor?: string;
} = {}) {
  return toSvgString(
    BRAND_MARK_VIEWBOX,
    120 * 4,
    72 * 4,
    brandMarkSvgElements(detail, markColors(variant, monoColor, flapColor)),
  );
}

// App icon and monogram, the "Send B": a B whose bowls are send arrows, with speed lines.
// Used where a square is needed: favicons, app icons, avatars and team badges.
export const BRAND_ICON_VIEWBOX = "0 0 120 120";

type IconColors = { stem: string; upper: string; lower: string; speed: string };

function iconColors(variant: "color" | "mono", monoColor: string): IconColors {
  return variant === "mono"
    ? { stem: monoColor, upper: monoColor, lower: monoColor, speed: monoColor }
    : { stem: BRAND_COLORS.blue, upper: BRAND_COLORS.sky, lower: BRAND_COLORS.blue, speed: BRAND_COLORS.teal };
}

export function brandIconSvgElements(detail: BrandMarkDetail, colors: IconColors): SvgElement[] {
  switch (detail) {
    case "full":
      return [
        { d: "M14 41H22M14 79H22", fill: "none", stroke: colors.speed, strokeWidth: 8 },
        { d: "M36 22H70L89 41L70 60H36", fill: "none", stroke: colors.upper, strokeWidth: 12 },
        { d: "M36 60H78L99 79L78 98H36", fill: "none", stroke: colors.lower, strokeWidth: 12 },
        { d: "M36 22V98", fill: "none", stroke: colors.stem, strokeWidth: 12 },
      ];
    case "compact":
      return [
        { d: "M28 22H62L81 41L62 60H28", fill: "none", stroke: colors.upper, strokeWidth: 15 },
        { d: "M28 60H70L91 79L70 98H28", fill: "none", stroke: colors.lower, strokeWidth: 15 },
        { d: "M28 22V98", fill: "none", stroke: colors.stem, strokeWidth: 15 },
      ];
    case "glyph":
      return [
        { d: "M30 22H62L80 41L62 60H30", fill: "none", stroke: colors.upper, strokeWidth: 19 },
        { d: "M30 60H69L89 79L69 98H30", fill: "none", stroke: colors.lower, strokeWidth: 19 },
        { d: "M30 22V98", fill: "none", stroke: colors.stem, strokeWidth: 19 },
      ];
  }
}

export function BrandIcon({
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
  const elements = brandIconSvgElements(detail ?? detailForSize(size), iconColors(variant, monoColor));

  return (
    <svg
      width={size}
      height={size}
      viewBox={BRAND_ICON_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      {elements.map((props) => (
        <path key={props.d} {...ROUND} {...props} />
      ))}
    </svg>
  );
}

export function brandIconSvgString({
  detail = "full",
  variant = "color",
  monoColor = BRAND_COLORS.ink,
  tile,
}: {
  detail?: BrandMarkDetail;
  variant?: "color" | "mono";
  monoColor?: string;
  tile?: string;
} = {}) {
  const svg = toSvgString(BRAND_ICON_VIEWBOX, 480, 480, brandIconSvgElements(detail, iconColors(variant, monoColor)));
  if (!tile) return svg;
  // The B sits at 76% of the tile, inside the safe zone iOS and Android masks keep.
  return svg
    .replace(">", `><rect width="120" height="120" rx="27" fill="${tile}"/><g transform="translate(14.4 14.4) scale(0.76)">`)
    .replace("</svg>", "</g></svg>");
}
