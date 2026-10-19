import { Reveal } from "./Reveal";

const steps = [
    {
        title: "Verify your domain",
        description:
            "Add your domain and copy the DKIM, SPF and DMARC records into your DNS. ByteSend checks them for you and tells you exactly what's missing.",
    },
    {
        title: "Send your first email",
        description:
            "Create an API key and send with one call from an SDK or the REST API — or point an existing app at the SMTP relay.",
    },
    {
        title: "Watch it land",
        description:
            "Follow every message from queued to delivered, opened and clicked. Webhooks and alerts tell you the moment something needs attention.",
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="border-t border-border/30 py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <Reveal className="mx-auto mb-12 max-w-2xl text-center">
                    <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-blue dark:text-brand-sky">
                        How it works
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From sign-up to inbox in three steps</h2>
                </Reveal>

                <ol className="grid gap-4 md:grid-cols-3">
                    {steps.map((step, index) => (
                        <Reveal as="li" key={step.title} delay={index * 90} className="relative rounded-2xl border border-border/40 bg-card/40 p-6">
                            <span
                                aria-hidden
                                className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue font-mono text-sm font-semibold text-white"
                            >
                                {index + 1}
                            </span>
                            <h3 className="mb-2 font-semibold">{step.title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                        </Reveal>
                    ))}
                </ol>
            </div>
        </section>
    );
}

export default HowItWorks;
