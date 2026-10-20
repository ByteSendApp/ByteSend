"use client";

import "./globals.css";
import { RotateCw } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { ErrorReference, ErrorScreen } from "~/components/error-screen";

// Replaces the root layout when it crashes, so it brings its own document and picks the theme itself.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')",
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ErrorScreen
          code="500"
          title="ByteSend couldn't load"
          description="Something broke before the page could start. Reloading usually fixes it. Your emails keep sending in the meantime."
          actions={
            <>
              <Button size="sm" onClick={reset}>
                <RotateCw className="size-3.5" />
                Try again
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/">Home page</a>
              </Button>
            </>
          }
          detail={<ErrorReference digest={error.digest} />}
        />
      </body>
    </html>
  );
}
