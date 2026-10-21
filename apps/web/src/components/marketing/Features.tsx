import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    FlaskConical,
    Globe2,
    Inbox,
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
import { HairlineGrid, Section, SectionHeader } from "./Section";

type Feature = {
    icon: LucideIcon;
    title: string;
    description: string;
    tone: "blue" | "sky" | "teal";
    wide?: boolean;
    points?: string[];
};

const toneClasses: Record<Feature["tone"], string> = {
    blue: "text-primary",
    sky: "text-primary-light",
    teal: "text-[#00a3b4] dark:text-brand-teal",
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
    {
        icon: Inbox,
        title: "Inbound email",
        description: "Receive mail on your own domain or a hosted address. Get it by webhook or API, read it in the inbox, or forward it on.",
        tone: "teal",
    },
    {
        icon: MailCheck,
        title: "DMARC reports",
        description: "See every server sending as your domain and whether it passes, before you tighten your policy to reject.",
        tone: "blue",
    },
    {
        icon: FlaskConical,
        title: "Test mode",
        description: "Test API keys simulate deliveries, bounces and complaints, with real webhooks and nothing sent.",
        tone: "sky",
    },
];

export function Features() {
    return (
        <Section id="features">
            <SectionHeader
                eyebrow="Features"
                title="Everything you need to send and receive email"
                description="Receipts, password resets, newsletters, replies and everything in between, on one platform with one bill."
            />

            <HairlineGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => (
                    <Reveal
                        key={feature.title}
                        delay={(index % 3) * 60}
                        className={cn("group p-6 transition-colors hover:bg-muted/30", feature.wide && "sm:col-span-2")}
                    >
                        <feature.icon className={cn("mb-4 size-5", toneClasses[feature.tone])} aria-hidden />
                        <h3 className="mb-1.5 text-[15px] font-semibold text-foreground">{feature.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                        {feature.points ? (
                            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                                {feature.points.map((point) => (
                                    <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </Reveal>
                ))}
            </HairlineGrid>
        </Section>
    );
}

export default Features;
