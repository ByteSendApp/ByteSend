import { Reveal } from "./Reveal";

const facts = [
  { value: "5,000", label: "Free emails every month" },
  { value: "AGPL-3.0", label: "Open source, every line" },
  { value: "REST · SMTP", label: "TypeScript, Python and Go SDKs" },
  { value: "Docker", label: "Self-host on your own AWS" },
];

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-muted/30">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">
        {facts.map((fact, index) => (
          <Reveal
            as="li"
            key={fact.label}
            delay={index * 70}
            className="border-border px-4 py-7 text-center odd:border-r sm:border-r sm:last:border-r-0 nth-[-n+2]:border-b sm:nth-[-n+2]:border-b-0"
          >
            <div className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{fact.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{fact.label}</div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

export default TrustStrip;
