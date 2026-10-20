import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { BRAND_COLORS, BrandMark } from "~/lib/brand";
import { Reveal } from "./Reveal";

export function CallToAction() {
  return (
    <section className="border-t border-border px-4 py-20 sm:px-6 sm:py-24">
      <Reveal
        className="relative mx-auto max-w-6xl overflow-hidden rounded-xl border border-border px-6 py-14 text-center sm:px-12 sm:py-20"
        style={{ background: BRAND_COLORS.ink }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 opacity-[0.08] md:block">
          <BrandMark size={300} flapColor={BRAND_COLORS.ink} />
        </div>
        <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">Start sending today.</h2>
        <p className="relative mx-auto mt-3 max-w-md text-base leading-relaxed text-white/65">
          Create an account in seconds and send 5,000 emails a month, free, for as long as you like.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button size="lg" className="h-11 w-full px-6 sm:w-auto" asChild>
            <Link href="/signup">
              Start sending free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-11 w-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white sm:w-auto" asChild>
            <a href="https://docs.bytesend.cloud/self-hosting/overview" target="_blank" rel="noopener noreferrer">
              Self-host with Docker
            </a>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export default CallToAction;
