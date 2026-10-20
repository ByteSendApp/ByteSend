import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import { PNG } from "pngjs";
import gifenc from "gifenc";
import { BRAND_COLORS, BrandIcon, BrandMark } from "../../src/lib/brand";

// gifenc is CommonJS, so its named exports are only reachable through the default import.
const { GIFEncoder, applyPalette, quantize } = gifenc;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public/brand/discord-emojis");
const SIZE = 128;
// Discord rejects emoji uploads over 256 KB.
const MAX_BYTES = 256 * 1024;

// GIF alpha is 1-bit, so "off" states use a solid muted tone instead of opacity.
const DIM = "#7d8aa6";

const STATUS = {
  success: "#16c784",
  danger: "#ef4444",
  warning: "#f5a524",
} as const;

function frame(children: ReactNode) {
  return (
    <div style={{ width: SIZE, height: SIZE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

async function renderPng(element: ReactElement) {
  const response = new ImageResponse(element, { width: SIZE, height: SIZE });
  return Buffer.from(await response.arrayBuffer());
}

function save(name: string, data: Buffer | Uint8Array) {
  if (data.length > MAX_BYTES) {
    throw new Error(`${name} is ${Math.round(data.length / 1024)} KB, over Discord's 256 KB emoji limit`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), data);
  console.log(`wrote ${name} (${Math.round(data.length / 1024)} KB)`);
}

// GIF transparency is 1-bit, so each frame is quantized with a hard alpha cutoff.
async function renderGif(frames: ReactElement[], delayMs: number) {
  const gif = GIFEncoder();
  for (const element of frames) {
    const { data } = PNG.sync.read(await renderPng(element));
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const palette = quantize(rgba, 256, { format: "rgba4444", oneBitAlpha: true, clearAlpha: true });
    const index = applyPalette(rgba, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);
    gif.writeFrame(index, SIZE, SIZE, {
      palette,
      delay: delayMs,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(transparentIndex, 0),
      dispose: 2,
    });
  }
  gif.finish();
  return gif.bytes();
}

// Satori serializes inline SVG itself and skips fragments and components nested inside <svg>,
// so the status emojis are composed from plain element arrays.
function envelopeWithBadge(badgeColor: string, glyph: ReactElement[]) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 128 128">
      <rect x="10" y="26" width="96" height="66" rx="12" fill={BRAND_COLORS.blue} />
      <path
        d="M16 34L58 64L100 34"
        fill="none"
        stroke={BRAND_COLORS.ice}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="96" cy="92" r="27" fill={badgeColor} stroke={BRAND_COLORS.ink} strokeWidth="5" />
      {glyph}
    </svg>
  );
}

const checkGlyph = [
  <path key="check" d="M84 92L93 101L109 84" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />,
];
const crossGlyph = [
  <path key="cross" d="M86 82L106 102M106 82L86 102" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />,
];
const alertGlyph = [
  <path key="bar" d="M96 79V95" stroke={BRAND_COLORS.ink} strokeWidth="8" strokeLinecap="round" />,
  <circle key="dot" cx="96" cy="105" r="4.5" fill={BRAND_COLORS.ink} />,
];

function Chevrons({ lit }: { lit: number }) {
  const colors = [BRAND_COLORS.blue, BRAND_COLORS.sky, BRAND_COLORS.teal];
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 128 128">
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${18 + i * 34} 34L${48 + i * 34} 64L${18 + i * 34} 94`}
          fill="none"
          stroke={i === lit ? colors[i] : DIM}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function SendingPulse({ step }: { step: number }) {
  const outerOn = step >= 6;
  const middleOn = step >= 3;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 24 120 72">
      <path
        d="M4 30H80L110 60L80 90H4"
        fill="none"
        stroke={outerOn ? BRAND_COLORS.blue : DIM}
        strokeWidth="8"
        strokeLinejoin="miter"
      />
      <path
        d="M18 43H74.5L91.5 60L74.5 77H18"
        fill="none"
        stroke={middleOn ? BRAND_COLORS.sky : DIM}
        strokeWidth="8"
        strokeLinejoin="miter"
      />
      <path d="M32 53H67L74 60L67 67H32Z" fill={BRAND_COLORS.teal} />
      <path
        d="M32 53L50 62L67 53"
        fill="none"
        stroke={BRAND_COLORS.ice}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlyingMail({ offset }: { offset: number }) {
  const x = offset;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 128 128">
      <path d={`M${x - 46} 50H${x - 14}`} stroke={BRAND_COLORS.sky} strokeWidth="6" strokeLinecap="round" />
      <path d={`M${x - 58} 64H${x - 14}`} stroke={BRAND_COLORS.teal} strokeWidth="6" strokeLinecap="round" />
      <path d={`M${x - 46} 78H${x - 14}`} stroke={BRAND_COLORS.sky} strokeWidth="6" strokeLinecap="round" />
      <rect x={x - 6} y="40" width="62" height="48" rx="9" fill={BRAND_COLORS.blue} />
      <path
        d={`M${x} 46L${x + 25} 66L${x + 50} 46`}
        fill="none"
        stroke={BRAND_COLORS.ice}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function main() {
  save("bs_logo.png", await renderPng(frame(<BrandMark size={SIZE / (120 / 72)} detail="full" />)));
  save("bs_send.png", await renderPng(frame(<BrandMark size={SIZE / (120 / 72)} detail="glyph" />)));
  save("bs_icon.png", await renderPng(frame(<BrandIcon size={SIZE} detail="full" />)));
  save(
    "bs_api.png",
    await renderPng(
      frame(
        <svg width={SIZE} height={SIZE} viewBox="0 0 128 128">
          <path d="M40 30L12 64L40 98" fill="none" stroke={BRAND_COLORS.blue} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M88 30L116 64L88 98" fill="none" stroke={BRAND_COLORS.blue} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M72 24L56 104" stroke={BRAND_COLORS.teal} strokeWidth="11" strokeLinecap="round" />
        </svg>,
      ),
    ),
  );
  save("bs_delivered.png", await renderPng(frame(envelopeWithBadge(STATUS.success, checkGlyph))));
  save("bs_bounced.png", await renderPng(frame(envelopeWithBadge(STATUS.danger, crossGlyph))));
  save("bs_held.png", await renderPng(frame(envelopeWithBadge(STATUS.warning, alertGlyph))));
  save(
    "bs_verified.png",
    await renderPng(
      frame(
        <svg width={SIZE} height={SIZE} viewBox="0 0 128 128">
          <path d="M64 8L108 24V60C108 88 90 108 64 120C38 108 20 88 20 60V24Z" fill={BRAND_COLORS.blue} />
          <path d="M64 20L96 32V60C96 81 83 96 64 106Z" fill={BRAND_COLORS.sky} />
          <path d="M44 64L58 78L86 48" fill="none" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>,
      ),
    ),
  );

  save(
    "bs_sending.gif",
    await renderGif(
      Array.from({ length: 12 }, (_, step) => frame(<SendingPulse step={step} />)),
      90,
    ),
  );
  save(
    "bs_loading.gif",
    await renderGif(
      [0, 1, 2].map((lit) => frame(<Chevrons lit={lit} />)),
      180,
    ),
  );
  save(
    "bs_mailfly.gif",
    await renderGif(
      Array.from({ length: 16 }, (_, i) => frame(<FlyingMail offset={-60 + i * 14} />)),
      55,
    ),
  );
}

await main();
