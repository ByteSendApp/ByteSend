import { OG_SIZE, renderBrandCard } from "~/lib/og/brand-card";

export const alt = "ByteSend open stats";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderBrandCard({
    eyebrow: "Open stats",
    title: "ByteSend, by the numbers",
    subtitle: "Emails sent, delivery rate and uptime, live.",
  });
}
