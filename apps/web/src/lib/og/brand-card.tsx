import { ImageResponse } from "next/og";
import { BRAND_COLORS, BRAND_NAME, BrandMark } from "../brand";

export const OG_SIZE = { width: 1200, height: 630 };

type FontWeight = 400 | 600 | 700;

async function loadGoogleFont(family: string, weight: FontWeight) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`;
  const css = await (await fetch(url)).text();
  const source = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!source?.[1]) throw new Error(`No font file for ${family} ${weight}`);
  const response = await fetch(source[1]);
  if (!response.ok) throw new Error(`Font download failed: ${response.status}`);
  return response.arrayBuffer();
}

// Font loading needs network; without it the image still renders in the default sans font.
async function loadFonts() {
  try {
    const [regular, bold] = await Promise.all([
      loadGoogleFont("Sora", 400),
      loadGoogleFont("Sora", 700),
    ]);
    return [
      { name: "Sora", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Sora", data: bold, weight: 700 as const, style: "normal" as const },
    ];
  } catch {
    return undefined;
  }
}

function StripeBar({ height }: { height: number }) {
  return (
    <div style={{ display: "flex", width: "100%", height }}>
      {[BRAND_COLORS.ice, BRAND_COLORS.teal, BRAND_COLORS.sky, BRAND_COLORS.blue].map((color) => (
        <div key={color} style={{ flex: 1, height, background: color }} />
      ))}
    </div>
  );
}

export async function renderBrandCard({
  eyebrow,
  title,
  subtitle,
  width = OG_SIZE.width,
  height = OG_SIZE.height,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  width?: number;
  height?: number;
}) {
  const scale = Math.min(width / OG_SIZE.width, height / OG_SIZE.height);
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BRAND_COLORS.ink,
          color: BRAND_COLORS.paper,
          ...(fonts ? { fontFamily: "Sora" } : {}),
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -140 * scale,
            top: 150 * scale,
            display: "flex",
            opacity: 0.08,
          }}
        >
          <BrandMark size={460 * scale} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: `${72 * scale}px ${80 * scale}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 * scale }}>
            <BrandMark size={48 * scale} />
            <span style={{ display: "flex", fontSize: 40 * scale, fontWeight: 700, letterSpacing: -1 }}>
              <span>{BRAND_NAME.slice(0, 4)}</span>
              <span style={{ color: BRAND_COLORS.sky }}>{BRAND_NAME.slice(4)}</span>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 * scale }}>
            {eyebrow ? (
              <span
                style={{
                  fontSize: 26 * scale,
                  fontWeight: 600,
                  color: BRAND_COLORS.ice,
                  textTransform: "uppercase",
                  letterSpacing: 4,
                  marginBottom: 20 * scale,
                }}
              >
                {eyebrow}
              </span>
            ) : null}
            <span style={{ fontSize: 68 * scale, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>{title}</span>
            {subtitle ? (
              <span style={{ fontSize: 30 * scale, color: "#a6b0c3", marginTop: 24 * scale, lineHeight: 1.35 }}>
                {subtitle}
              </span>
            ) : null}
          </div>

          <span style={{ fontSize: 24 * scale, color: "#7c879c" }}>bytesend.cloud</span>
        </div>

        <StripeBar height={12 * scale} />
      </div>
    ),
    { width, height, ...(fonts ? { fonts } : {}) },
  );
}
