import { redirect } from "next/navigation";
import { CallToAction } from "~/components/marketing/CallToAction";
import { ExploreSection } from "~/components/marketing/ExploreSection";
import { TrustStrip } from "~/components/marketing/TrustStrip";
import { PricingTeaser } from "~/components/marketing/PricingTeaser";
import { DevSection } from "~/components/marketing/DevSection";
import { Features } from "~/components/marketing/Features";
import { Hero } from "~/components/marketing/Hero";
import { HowItWorks } from "~/components/marketing/HowItWorks";

import { env } from "~/env";

export const dynamic = "force-static";

export default function Page() {
  if (!env.NEXT_PUBLIC_IS_CLOUD) redirect("/login");

  return (
    <main className="min-h-screen text-foreground bg-background">
      <Hero />
      <TrustStrip />
      <DevSection />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <ExploreSection />
      <CallToAction />
    </main>
  );
}