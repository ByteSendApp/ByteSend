"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FaRegCircleDot } from "react-icons/fa6";
import { SiGo, SiPhp, SiPython, SiRuby, SiRust, SiTypescript } from "react-icons/si";

type LangItem = {
  key: string;
  label: string;
  kind: string;
};

export function LangToggle({
  containerId,
  languages,
  defaultLang,
}: {
  containerId: string;
  languages: LangItem[];
  defaultLang: string;
}) {
  const [active, setActive] = useState(defaultLang);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const slots = Array.from(
      container.querySelectorAll<HTMLElement>("[data-lang-slot]")
    );
    for (const el of slots) {
      const key = el.getAttribute("data-lang-slot");
      if (key === active) {
        el.classList.remove("hidden");
        el.classList.add("block");
      } else {
        el.classList.add("hidden");
        el.classList.remove("block");
      }
    }
  }, [active, containerId]);

  const activeKind = languages.find((l) => l.key === active)?.kind ?? "";

  return (
    <div className="relative">
      <LangIcon kind={activeKind} className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      <select
        aria-label="Code language"
        value={active}
        onChange={(e) => setActive(e.target.value)}
        className="h-8 min-w-40 cursor-pointer appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-44"
      >
        {languages.map((l) => (
          <option key={l.key} value={l.key}>
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function LangIcon({ kind, className = "h-4 w-4" }: { kind: string; className?: string }) {
  const iconMap = {
    ts: SiTypescript,
    py: SiPython,
    go: SiGo,
    php: SiPhp,
    rs: SiRust,
    rb: SiRuby,
  } as const;

  const Icon = iconMap[kind as keyof typeof iconMap];

  if (!Icon) {
    return <FaRegCircleDot aria-hidden="true" className={className} role="img" />;
  }

  return <Icon aria-hidden="true" className={className} role="img" />;
}

export default LangToggle;
