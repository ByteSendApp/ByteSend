"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
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

  return (
    <Select value={active} onValueChange={setActive}>
      <SelectTrigger className="h-8 min-w-40 bg-background text-xs sm:min-w-44">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-44">
        {languages.map((l) => (
          <SelectItem key={l.key} value={l.key} className="text-xs">
            <span className="inline-flex items-center gap-2">
              <LangIcon kind={l.kind} className="h-3.5 w-3.5 shrink-0" />
              {l.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
