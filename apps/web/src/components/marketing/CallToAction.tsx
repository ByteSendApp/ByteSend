import Link from "next/link";
import { Button } from "@bytesend/ui/src/button";
import { BrandMark } from "~/lib/brand";
import { Reveal } from "./Reveal";

const APP_URL = "/login";

export function CallToAction() {
    return (
        <section className="relative overflow-hidden border-t border-border/30 bg-muted/20">
            <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 hidden opacity-[0.06] dark:opacity-[0.09] md:block">
                <BrandMark size={360} detail="full" />
            </div>

            <Reveal className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Start sending today.</h2>
                <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Create a free account in seconds and send 5,000 emails a month, free, for as long as you like.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button size="lg" className="h-12 w-full rounded-xl px-8 text-base sm:w-auto" asChild>
                        <Link href={APP_URL}>Start sending free</Link>
                    </Button>
                    <Button variant="outline" size="lg" className="h-12 w-full rounded-xl px-8 text-base sm:w-auto" asChild>
                        <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer">
                            Read the docs
                        </a>
                    </Button>
                </div>

                <p className="mt-5 text-xs text-muted-foreground">
                    Prefer to run it yourself?{" "}
                    <a
                        href="https://docs.bytesend.cloud/self-hosting/overview"
                        className="underline underline-offset-2 hover:text-foreground"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Self-host ByteSend with Docker →
                    </a>
                </p>
            </Reveal>

            <div aria-hidden className="flex h-1.5">
                <span className="flex-1 bg-brand-ice" />
                <span className="flex-1 bg-brand-teal" />
                <span className="flex-1 bg-brand-sky" />
                <span className="flex-1 bg-brand-blue" />
            </div>
        </section>
    );
}

export default CallToAction;
