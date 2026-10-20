import { BrandIcon } from "~/lib/brand";

export const FullScreenLoading = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background" role="status" aria-label="Loading">
    <div className="animate-pulse">
      <BrandIcon size={36} />
    </div>
    <div className="h-0.5 w-24 overflow-hidden rounded-full bg-muted">
      <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  </div>
);
