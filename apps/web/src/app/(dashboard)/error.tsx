"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { Panel } from "@bytesend/ui/src/panel";
import { ErrorReference } from "~/components/error-screen";

// Keeps the sidebar and header in place so a crash in one page doesn't take over the whole dashboard.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel flush className="mt-4">
      <EmptyState
        className="py-20"
        icon={<AlertTriangle />}
        title="This page couldn't load"
        description="Something went wrong while loading it. Your data is safe. Try again, or carry on elsewhere and come back."
        action={
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
              <Button size="sm" onClick={reset}>
                <RotateCw className="size-3.5" />
                Try again
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Overview</Link>
              </Button>
            </div>
            <ErrorReference digest={error.digest} />
          </div>
        }
      />
    </Panel>
  );
}
