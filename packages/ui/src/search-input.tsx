import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";

export const SearchInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[13px] shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";

/** A row of search and filter controls above a list. Wraps on narrow screens. */
export function FilterBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)} {...props} />;
}
