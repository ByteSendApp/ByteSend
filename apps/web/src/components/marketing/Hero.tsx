import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { ProductPreview } from "./ProductPreview";
import { HeroBackdrop } from "./HeroBackdrop";

const APP_URL = "/signup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <HeroBackdrop />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/changelog"
            className="group mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">New</span>
            Inbound email, DMARC reports and test mode
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Email infrastructure
            <br className="hidden sm:block" />{" "}
            <span className="text-muted-foreground">that just works.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Send transactional and marketing email through one API, SMTP relay and SDKs, with deliverability guardrails built in. Start free,
            pay only for what you send, or self-host it.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button size="lg" className="h-11 w-full px-6 sm:w-auto" asChild>
              <Link href={APP_URL}>
                Start sending free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-11 w-full px-6 sm:w-auto" asChild>
              <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer">
                Read the docs
              </a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">5,000 emails a month free · No credit card · Open source</p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-16">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

export default Hero;
