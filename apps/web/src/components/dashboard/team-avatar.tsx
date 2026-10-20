"use client";

import { useEffect, useState } from "react";
import { BrandIcon } from "~/lib/brand";

/** A team's uploaded image, or the ByteSend icon when there isn't one or it fails to load. */
export function TeamAvatar({ image, name, size }: { image?: string | null; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/60"
      style={{ width: size, height: size }}
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- team images come from any storage host
        <img src={image} alt={name} width={size} height={size} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <BrandIcon size={Math.round(size * 0.62)} />
      )}
    </div>
  );
}
