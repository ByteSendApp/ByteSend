import { SessionWrapper } from "~/components/marketing/SessionWrapper";
import { TopNav } from "~/components/marketing/TopNav";
import { SiteFooter } from "~/components/marketing/SiteFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ByteSend – The email platform for modern teams",
  description:
    "Send product, transactional and marketing emails. Pay only for what you send.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/favicon_io/apple-touch-icon.png",
  },
  manifest: "/favicon_io/site.webmanifest",
  metadataBase: new URL("https://bytesend.cloud"),
  openGraph: {
    title: "ByteSend – The email platform for modern teams",
    description: "Send product, transactional and marketing emails. Pay only for what you send.",
    url: "https://bytesend.cloud",
    siteName: "ByteSend",
    images: [
      {
        url: "https://embrly.ca/ibNxG/eq0hwI.png/raw",
        width: 1200,
        height: 630,
        alt: "ByteSend – The email platform for modern teams",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ByteSend – The email platform for modern teams",
    description: "Send product, transactional and marketing emails. Pay only for what you send.",
    images: ["https://embrly.ca/ibNxG/eq0hwI.png/raw"], 
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://bytesend.cloud",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionWrapper>
      <TopNav />
      <div className="h-[53px]" />
      {children}
      <SiteFooter />
    </SessionWrapper>
  );
}
