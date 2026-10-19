import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { BrandMark } from "~/lib/brand";

const APP_URL = "/login";

export function Hero() {
    return (
        <section className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-48 top-16 hidden opacity-[0.07] dark:opacity-[0.1] lg:block">
                <BrandMark size={520} detail="full" />
            </div>

            <div className="relative mx-auto max-w-4xl px-6 pt-28 pb-16 text-center sm:pt-40 sm:pb-24">
                <Link
                    href="/changelog"
                    className="group mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-blue/40 hover:text-foreground"
                >
                    <span className="rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        New
                    </span>
                    Spam protection, region moves and a new look in v0.4
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                    Email infrastructure
                    <br />
                    <span className="bg-gradient-to-r from-brand-blue to-brand-sky bg-clip-text text-transparent">
                        that just works
                    </span>
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Send transactional and marketing email through one API, SMTP relay and SDKs, with
                    deliverability guardrails built in. Start free, pay only for what you send, or self-host it.
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

                <p className="mt-4 text-xs text-muted-foreground">
                    No credit card · 12,500 emails a month free · Open source
                </p>

                <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
                    <div className="rounded-2xl border border-border/40 bg-gradient-to-b from-brand-blue/10 to-transparent p-1.5 shadow-[0_30px_80px_-30px_rgba(0,87,255,0.35)]">
                        <div className="overflow-hidden rounded-[12px] border border-border/40">
                            <Image
                                src="/hero-light.webp"
                                alt="The ByteSend dashboard showing email analytics"
                                width={3456}
                                height={1914}
                                className="block h-auto w-full dark:hidden"
                                sizes="(min-width: 1024px) 900px, 100vw"
                                priority
                            />
                            <Image
                                src="/hero-dark.webp"
                                alt="The ByteSend dashboard showing email analytics"
                                width={3456}
                                height={1914}
                                className="hidden h-auto w-full dark:block"
                                sizes="(min-width: 1024px) 900px, 100vw"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Hero;
