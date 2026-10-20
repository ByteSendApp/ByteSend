import { Reveal } from "./Reveal";

const facts = [
    { value: "5,000", label: "Free emails a month" },
    { value: "AGPL-3.0", label: "Open source, every line" },
    { value: "REST · SMTP", label: "Plus TypeScript, Python and Go SDKs" },
    { value: "Docker", label: "Self-host on your own AWS account" },
];

export function TrustStrip() {
    return (
        <div className="border-y border-border/30 bg-muted/10">
            <div className="mx-auto max-w-5xl px-6">
                <ul className="grid grid-cols-2 divide-border/30 sm:grid-cols-4 sm:divide-x">
                    {facts.map((fact, index) => (
                        <Reveal as="li" key={fact.label} delay={index * 80} className="px-4 py-8 text-center">
                            <div className="text-xl font-bold tracking-tight sm:text-2xl">{fact.value}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{fact.label}</div>
                        </Reveal>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default TrustStrip;
