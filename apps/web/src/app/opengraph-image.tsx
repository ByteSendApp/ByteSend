import { OG_SIZE, renderBrandCard } from "~/lib/og/brand-card";

export const alt = "ByteSend – The email platform for modern teams";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderBrandCard({
    title: "The email platform for modern teams",
    subtitle: "Transactional and marketing email with a clean API, SMTP relay, and pay-as-you-send pricing.",
  });
}
