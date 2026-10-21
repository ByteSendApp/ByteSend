"use client";

import { Search } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { ToolError, ToolResultCard } from "~/components/marketing/tools/tool-result";
import { useToolCheck } from "~/components/marketing/tools/use-tool-check";
import type { DmarcCheck, DmarcGrade } from "~/server/service/dmarc-check-service";

const FIELDS = ["domain"];

const GRADES: Record<DmarcGrade, { label: string; variant: "success" | "warning" | "danger"; summary: string }> = {
  missing: { label: "Not protected", variant: "danger", summary: "This domain has no DMARC record." },
  invalid: { label: "Broken", variant: "danger", summary: "This domain's DMARC record won't be honoured." },
  monitoring: { label: "Monitoring only", variant: "warning", summary: "DMARC is set up, but spoofed mail is still delivered." },
  partial: { label: "Partly enforced", variant: "warning", summary: "Some spoofed mail is still getting through." },
  enforced: { label: "Enforced", variant: "success", summary: "Mail pretending to be this domain is blocked." },
};

export function DmarcChecker() {
  const { values, setValue, run, result, error, loading } = useToolCheck<DmarcCheck>("/api/tools/dmarc", FIELDS);
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
          Check DMARC
        </Button>
      </form>

      {error ? <ToolError message={error} /> : null}

      {result && grade ? (
        <ToolResultCard
          subject={result.domain}
          summary={grade.summary}
          badge={grade}
          records={
            result.record
              ? [
                  {
                    label: result.inherited
                      ? `Record found on ${result.lookedUp}, which also covers ${result.domain}`
                      : `Record at _dmarc.${result.lookedUp}`,
                    value: result.record,
                  },
                ]
              : []
          }
          findings={result.findings}
          suggestion={
            result.suggestion
              ? {
                  label: (
                    <>
                      {result.record ? "A better record to start from" : "A record to start with"} (TXT at{" "}
                      <span className="font-mono">_dmarc.{result.lookedUp}</span>)
                    </>
                  ),
                  value: result.suggestion,
                }
              : null
          }
          cta={{
            text: (
              <>
                See every server sending as <span className="font-medium text-foreground">{result.lookedUp}</span>, and whether it passes. ByteSend
                reads your DMARC reports for free.
              </>
            ),
            label: "Get DMARC reports",
            href: "/signup",
          }}
        />
      ) : null}
    </div>
  );
}
