"use client";

export const dynamic = "force-static";

// Settings sections live in the main sidebar (see getSettingsNavGroups); each page renders its own header.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}
