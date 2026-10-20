"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { ErrorReference, ErrorScreen } from "~/components/error-screen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      code="500"
      title="Something went wrong on our side"
      description="This page hit an unexpected error. Trying again usually fixes it. If it keeps happening, send us the reference below."
      actions={
        <>
          <Button size="sm" onClick={reset}>
            <RotateCw className="size-3.5" />
            Try again
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Go to the dashboard</Link>
          </Button>
        </>
      }
      detail={<ErrorReference digest={error.digest} />}
    />
  );
}
