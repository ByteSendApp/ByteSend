import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

/** Previous/next controls for a Panel footer. */
export function PaginationBar({
  page,
  hasNext,
  onPageChange,
  summary,
}: {
  page: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  /** Replaces "Page N", e.g. "1–20 of 312". */
  summary?: React.ReactNode;
}) {
  return (
    <>
      <span className="text-xs tabular-nums text-muted-foreground">{summary ?? `Page ${page}`}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPageChange(page + 1)} disabled={!hasNext}>
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
