"use client";

import { Search } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { ToolError, ToolResultCard } from "~/components/marketing/tools/tool-result";
import { useToolCheck } from "~/components/marketing/tools/use-tool-check";
import type { SpfCheck, SpfGrade } from "~/server/service/spf-check-service";

const FIELDS = ["domain"];

const GRADES: Record<SpfGrade, { label: string; variant: "success" | "warning" | "danger"; summary: string }> = {
  missing: { label: "No SPF", variant: "danger", summary: "This domain doesn't say which servers may send as it." },
  invalid: { label: "Broken", variant: "danger", summary: "Mail providers will treat this SPF record as an error." },
  open: { label: "Wide open", variant: "danger", summary: "This record lets any server send as this domain." },
  neutral: { label: "Weak", variant: "warning", summary: "SPF is set up, but it doesn't reject anything." },
  softfail: { label: "Good", variant: "success", summary: "SPF is set up the way most senders use it." },
  strict: { label: "Strict", variant: "success", summary: "Only the servers listed may send as this domain." },
};

export function SpfChecker() {
  const { values, setValue, run, result, error, loading } = useToolCheck<SpfCheck>("/api/tools/spf", FIELDS);
  const domain = values.domain ?? "";
  const grade = result ? GRADES[result.grade] : null;

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <Input
          value={domain}
          onChange={(event) => setValue("domain", event.target.value)}
          placeholder="yourdomain.com"
          aria-label="Domain"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
          className="h-11 text-base sm:text-sm"
        />
        <Button type="submit" size="lg" className="h-11 shrink-0 px-6" isLoading={loading} disabled={!domain.trim()}>
          <Search className="size-4" />
          Check SPF
        </Button>
      </form>

      {error ? <ToolError message={error} /> : null}

      {result && grade ? (
        <ToolResultCard
          subject={result.domain}
          summary={grade.summary}
          badge={grade}
          records={result.record ? [{ label: `SPF record on ${result.domain}`, value: result.record }] : []}
          findings={[
            ...result.findings,
            ...(result.includes.length
              ? [{ level: "good" as const, title: "Includes", detail: result.includes.join(", ") }]
              : []),
          ]}
          cta={{
            text: "Sending with ByteSend? We set up SPF on a mail. subdomain for you, so it never adds to your main record's lookup count.",
            label: "Start free",
            href: "/signup",
          }}
        />
      ) : null}
    </div>
  );
}
