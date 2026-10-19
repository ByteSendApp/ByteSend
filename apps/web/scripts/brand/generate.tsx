import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import {
  BRAND_COLORS,
  BRAND_MARK_ASPECT,
  BRAND_NAME,
  BRAND_TAGLINE,
  BrandMark,
  brandMarkSvgString,
  type BrandMarkDetail,
} from "../../src/lib/brand";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public");

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };

async function loadGoogleFont(family: string, weight: 400 | 600 | 800): Promise<Font> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family} ${weight}`);
  return { name: family, data: await (await fetch(url)).arrayBuffer(), weight, style: "normal" };
}

function write(relativePath: string, data: Buffer | string) {
  const target = join(PUBLIC_DIR, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log("wrote", relativePath);
}

async function png(element: ReactElement, width: number, height: number, fonts: Font[]) {
  const response = new ImageResponse(element, { width, height, fonts });
  return Buffer.from(await response.arrayBuffer());
}

// ICO files may embed PNG frames directly; each directory entry points at one frame.
function encodeIco(frames: Array<{ size: number; data: Buffer }>) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const entries = frames.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...frames.map((frame) => frame.data)]);
}

function Wordmark({ height, onDark }: { height: number; onDark: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: height * 0.16 }}>
      <BrandMark size={height * 0.62} detail="full" />
      <div style={{ display: "flex", fontFamily: "Sora", fontWeight: 800, fontSize: height * 0.62, letterSpacing: -height * 0.008 }}>
        <span style={{ color: onDark ? BRAND_COLORS.paper : BRAND_COLORS.ink }}>Byte</span>
        <span style={{ color: onDark ? BRAND_COLORS.sky : BRAND_COLORS.blue }}>Send</span>
      </div>
    </div>
  );
}

function MarkOnly({ size, detail, background, radius = 0, inset = 0.14 }: {
  size: number;
  detail: BrandMarkDetail;
  background?: string;
  radius?: number;
  inset?: number;
}) {
  const markWidth = size * (1 - inset * 2);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: background ?? "transparent",
        borderRadius: radius,
      }}
    >
      <BrandMark size={markWidth / BRAND_MARK_ASPECT} detail={detail} />
    </div>
  );
}

function Banner({
  width,
  height,
  align = "center",
  showTagline = true,
  contentScale = 1,
}: {
  width: number;
  height: number;
  align?: "center" | "right";
  showTagline?: boolean;
  contentScale?: number;
}) {
  const unit = Math.min(width / 1280, height / 640) * contentScale;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BRAND_COLORS.ink,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", right: -60 * unit, top: height * 0.08, display: "flex", opacity: 0.06 }}>
        <BrandMark size={height * 0.84} detail="full" />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: align === "center" ? "center" : "flex-end",
          justifyContent: "center",
          padding: `0 ${96 * unit}px`,
          gap: 28 * unit,
        }}
      >
        <Wordmark height={150 * unit} onDark />
        {showTagline ? (
          <span style={{ fontFamily: "Sora", fontWeight: 400, fontSize: 38 * unit, color: "#a6b0c3" }}>{BRAND_TAGLINE}</span>
        ) : null}
        <span
          style={{
            fontFamily: "Sora",
            fontWeight: 600,
            fontSize: 26 * unit,
            color: BRAND_COLORS.ice,
            letterSpacing: 4 * unit,
            textTransform: "uppercase",
          }}
        >
          bytesend.cloud
        </span>
      </div>
      <div style={{ display: "flex", height: 10 * unit }}>
        {[BRAND_COLORS.ice, BRAND_COLORS.teal, BRAND_COLORS.sky, BRAND_COLORS.blue].map((color) => (
          <div key={color} style={{ flex: 1, background: color }} />
        ))}
      </div>
    </div>
  );
}

async function main() {
  const fonts = await Promise.all([
    loadGoogleFont("Sora", 400),
    loadGoogleFont("Sora", 600),
    loadGoogleFont("Sora", 800),
  ]);

  write("logo.svg", brandMarkSvgString({ detail: "full" }));
  write("favicon.svg", brandMarkSvgString({ detail: "compact" }));
  write("brand/mark.svg", brandMarkSvgString({ detail: "full" }));
  write("brand/mark-compact.svg", brandMarkSvgString({ detail: "compact" }));
  write("brand/mark-glyph.svg", brandMarkSvgString({ detail: "glyph" }));
  write("brand/mark-mono-black.svg", brandMarkSvgString({ detail: "full", variant: "mono", monoColor: "#000000" }));
  write("brand/mark-mono-white.svg", brandMarkSvgString({ detail: "full", variant: "mono", monoColor: "#ffffff" }));

  write("logo.png", await png(<MarkOnly size={1024} detail="full" />, 1024, 1024, fonts));
  write(
    "logo-squircle.png",
    await png(<MarkOnly size={512} detail="compact" background={BRAND_COLORS.ink} radius={116} inset={0.16} />, 512, 512, fonts),
  );
  write("nameplate.png", await png(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}><Wordmark height={320} onDark={false} /></div>, 1600, 500, fonts));
  write("brand/wordmark-light.png", await png(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}><Wordmark height={320} onDark={false} /></div>, 1600, 500, fonts));
  write("brand/wordmark-dark.png", await png(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}><Wordmark height={320} onDark /></div>, 1600, 500, fonts));
  // Tight crops for places that scale a logo to a fixed height, such as the docs navbar.
  write("brand/wordmark-light-tight.png", await png(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}><Wordmark height={250} onDark={false} /></div>, 1200, 220, fonts));
  write("brand/wordmark-dark-tight.png", await png(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}><Wordmark height={250} onDark /></div>, 1200, 220, fonts));
  write("brand/app-icon-1024.png", await png(<MarkOnly size={1024} detail="full" background={BRAND_COLORS.ink} radius={232} inset={0.16} />, 1024, 1024, fonts));

  write("favicon_io/android-chrome-512x512.png", await png(<MarkOnly size={512} detail="full" background={BRAND_COLORS.ink} radius={116} inset={0.16} />, 512, 512, fonts));
  write("favicon_io/android-chrome-192x192.png", await png(<MarkOnly size={192} detail="full" background={BRAND_COLORS.ink} radius={44} inset={0.16} />, 192, 192, fonts));
  write("favicon_io/apple-touch-icon.png", await png(<MarkOnly size={180} detail="full" background={BRAND_COLORS.ink} inset={0.17} />, 180, 180, fonts));

  const favicon16 = await png(<MarkOnly size={16} detail="glyph" inset={0.02} />, 16, 16, fonts);
  const favicon32 = await png(<MarkOnly size={32} detail="compact" inset={0.03} />, 32, 32, fonts);
  const favicon48 = await png(<MarkOnly size={48} detail="compact" inset={0.04} />, 48, 48, fonts);
  write("favicon_io/favicon-16x16.png", favicon16);
  write("favicon_io/favicon-32x32.png", favicon32);
  const ico = encodeIco([
    { size: 16, data: favicon16 },
    { size: 32, data: favicon32 },
    { size: 48, data: favicon48 },
  ]);
  write("favicon.ico", ico);
  write("favicon_io/favicon.ico", ico);

  write("brand/github-social-preview.png", await png(<Banner width={1280} height={640} />, 1280, 640, fonts));
  write("brand/discord-banner.png", await png(<Banner width={960} height={540} showTagline={false} />, 960, 540, fonts));
  write("brand/discord-invite-splash.png", await png(<Banner width={1920} height={1080} />, 1920, 1080, fonts));
  // X's mobile app zooms the header, crops both sides and overlays buttons in the top corners,
  // so the lockup stays small and centred inside the area every client shows.
  write("brand/x-header.png", await png(<Banner width={1500} height={500} contentScale={0.82} />, 1500, 500, fonts));
  write("brand/social-avatar.png", await png(<MarkOnly size={400} detail="full" background={BRAND_COLORS.ink} inset={0.15} />, 400, 400, fonts));

  console.log(`\n${BRAND_NAME} brand assets generated.`);
}

await main();
