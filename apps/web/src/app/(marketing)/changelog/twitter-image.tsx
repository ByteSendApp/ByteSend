import { OG_SIZE, renderBrandCard } from "~/lib/og/brand-card";

export const alt = "ByteSend changelog";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderBrandCard({
    eyebrow: "Changelog",
    title: "What's new in ByteSend",
    subtitle: "Every feature, fix and improvement, as it ships.",
  });
}
