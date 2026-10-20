import { useTheme } from "@bytesend/ui";
import { BrandMark } from "~/lib/brand";

export const FullScreenLoading = () => {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 animate-pulse">
        <BrandMark size={21} />
      </div>
      <p className="text-xs text-muted-foreground/60">Loading...</p>
    </div>
  );
};
