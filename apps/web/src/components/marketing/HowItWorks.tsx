import { Reveal } from "./Reveal";
import { HairlineGrid, Section, SectionHeader } from "./Section";

const steps = [
  {
    title: "Verify your domain",
    description:
      "Add your domain and copy the DKIM, SPF and DMARC records into your DNS. ByteSend checks them for you and tells you exactly what's missing.",
  },
  {
    title: "Send your first email",
    description: "Create an API key and send with one call from an SDK or the REST API, or point an existing app at the SMTP relay.",
  },
  {
    title: "Watch it land",
    description:
      "Follow every message from queued to delivered, opened and clicked. Webhooks and alerts tell you the moment something needs attention.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" tinted>
      <SectionHeader eyebrow="How it works" title="From sign-up to inbox in three steps" />
      <HairlineGrid className="md:grid-cols-3">
        {steps.map((step, index) => (
          <Reveal as="div" key={step.title} delay={index * 80} className="p-6">
            <span className="font-mono text-xs font-medium text-primary">0{index + 1}</span>
            <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </Reveal>
        ))}
      </HairlineGrid>
    </Section>
  );
}

export default HowItWorks;
