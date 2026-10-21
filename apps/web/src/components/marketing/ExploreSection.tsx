import Link from "next/link";
import { ArrowRight, GitBranch, Inbox, Lock, Scale, ServerCog, Wrench } from "lucide-react";
import { Reveal } from "./Reveal";
import { Section, SectionHeader } from "./Section";

const LINKS = [
  {
    href: "/receiving",
    icon: Inbox,
    title: "Receive email too",
    text: "Give your app an address and get every message as a webhook, through the API, in an inbox, or forwarded on.",
  },
  {
    href: "/smtp",
    icon: ServerCog,
    title: "SMTP relay",
    text: "Point WordPress, Laravel, Django or any SMTP app at ByteSend by changing one setting.",
  },
  {
    href: "/tools",
    icon: Wrench,
    title: "Free email tools",
    text: "Check any domain's DMARC, SPF and DKIM in seconds, with plain-language results.",
  },
  {
    href: "/open-source",
    icon: GitBranch,
    title: "Open source",
    text: "Read every line, or run the same code on your own servers with your own Amazon SES account.",
  },
  {
    href: "/security",
    icon: Lock,
    title: "Security",
    text: "How your account, email and data are protected, and who helps us process it.",
  },
  {
    href: "/compare",
    icon: Scale,
    title: "How we compare",
    text: "ByteSend next to Resend, SendGrid, Postmark and Amazon SES, and when each is the better fit.",
  },
];

export function ExploreSection() {
  return (
    <Section tinted>
      <SectionHeader eyebrow="Explore" title="More to ByteSend than sending" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link, index) => (
          <Reveal key={link.href} delay={(index % 3) * 60}>
            <Link
              href={link.href}
              className="group flex h-full flex-col rounded-lg border border-border bg-background p-5 transition-colors hover:border-primary/40"
            >
              <link.icon className="size-5 text-primary" aria-hidden />
              <p className="mt-4 flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                {link.title}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{link.text}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default ExploreSection;
