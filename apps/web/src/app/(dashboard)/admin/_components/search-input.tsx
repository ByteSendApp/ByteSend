"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@bytesend/ui/src/input";
import { cn } from "@bytesend/ui/lib/utils";

export function SearchInput({
  onSearch,
  placeholder,
  label,
  className,
  defaultValue = "",
}: {
  onSearch: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const debounced = useDebouncedCallback((next: string) => onSearch(next.trim()), 300);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          debounced(event.target.value);
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pl-8"
      />
    </div>
  );
}
