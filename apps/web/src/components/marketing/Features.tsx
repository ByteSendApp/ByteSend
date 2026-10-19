import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    Globe2,
    MailCheck,
    PenTool,
    Server,
    ShieldAlert,
    ShieldCheck,
    Users,
    Webhook,
} from "lucide-react";
import { cn } from "@bytesend/ui/lib/utils";
import { Reveal } from "./Reveal";

type Feature = {
    icon: LucideIcon;
    title: string;
    description: string;
    tone: "blue" | "sky" | "teal";
    wide?: boolean;
    points?: string[];
};

const toneClasses: Record<Feature["tone"], string> = {
    blue: "bg-brand-blue/10 text-brand-blue dark:text-brand-sky",
    sky: "bg-brand-sky/15 text-brand-blue dark:text-brand-sky",
    teal: "bg-brand-teal/15 text-[#007f8c] dark:text-brand-teal",
};

const features: Feature[] = [
    {
        icon: ShieldCheck,
        title: "Deliverability guardrails",
        description:
            "Your reputation is protected before it's damaged, not after. ByteSend watches every team's sending and steps in early.",
        tone: "blue",
        wide: true,
        points: [
            "Bounce and complaint limits at Google and Yahoo thresholds",
            "Hard bounces and complaints suppressed automatically",
            "Guided DKIM, SPF and DMARC setup with live DNS checks",
            "One-click unsubscribe (RFC 8058) on marketing mail",
        ],
    },
    {
        icon: ShieldAlert,
        title: "Spam protection",
        description:
            "Outbound mail is scored before it's queued. Phishing, look-alike links and risky attachments are held for review instead of sent.",
        tone: "sky",
    },
    {
        icon: BarChart3,
        title: "Real-time analytics",
        description: "Deliveries, opens, clicks, bounces and complaints as they happen, across transactional and marketing sends.",
        tone: "teal",
    },
    {
        icon: PenTool,
        title: "Visual email editor",
        description: "Design templates and campaigns without code, with variables for personalisation.",
        tone: "blue",
    },
    {
        icon: Users,
        title: "Contacts & campaigns",
        description: "Contact books with double opt-in, consent tracking and batched campaign sends.",
        tone: "sky",
    },
    {
        icon: Server,
        title: "SMTP relay",
        description: "Point any existing app at ByteSend by changing one config value. No code changes.",
        tone: "teal",
    },
    {
        icon: Webhook,
        title: "Signed webhooks",
        description: "Every email and domain event pushed to you in real time, signed and retried until delivered.",
        tone: "blue",
    },
    {
        icon: Globe2,
        title: "Your region, your move",
        description: "Pick the AWS region each domain sends from, and move it later with zero downtime.",
        tone: "sky",
    },
];

export function Features() {
    return (
        <section id="features" className="border-t border-border/30 py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <Reveal className="mx-auto mb-12 max-w-2xl text-center">
                    <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-blue dark:text-brand-sky">
                        Features
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to send email</h2>
                    <p className="mt-4 text-muted-foreground">
                        Receipts, password resets, newsletters and everything in between, on one platform, with one bill.
                    </p>
                </Reveal>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, index) => (
                        <Reveal
                            key={feature.title}
                            delay={(index % 3) * 70}
                            className={cn(
                                "group rounded-2xl border border-border/40 bg-card/40 p-6 transition-colors hover:border-brand-blue/30",
                                feature.wide && "sm:col-span-2",
                            )}
                        >
                            <div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-xl", toneClasses[feature.tone])}>
                                <feature.icon className="h-5 w-5" aria-hidden />
                            </div>
                            <h3 className="mb-2 font-semibold">{feature.title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                            {feature.points ? (
                                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {feature.points.map((point) => (
                                        <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                                            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" aria-hidden />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default Features;
