"use client";

import { Search } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { ToolError, ToolResultCard } from "~/components/marketing/tools/tool-result";
import { useToolCheck } from "~/components/marketing/tools/use-tool-check";
import type { DkimCheck } from "~/server/service/dkim-check-service";

const FIELDS = ["domain", "selector"];

const GRADES: Record<DkimCheck["grade"], { label: string; variant: "success" | "warning" | "danger"; summary: string }> = {
  missing: { label: "Not found", variant: "danger", summary: "No DKIM key found." },
  broken: { label: "Broken", variant: "danger", summary: "A DKIM key exists, but signatures using it will fail." },
  weak: { label: "Weak", variant: "danger", summary: "The DKIM key is too short to be trusted." },
  ok: { label: "OK", variant: "warning", summary: "DKIM works, but a stronger key is recommended." },
  strong: { label: "Strong", variant: "success", summary: "DKIM is set up with a strong key." },
};

export function DkimChecker() {
  const { values, setValue, run, result, error, loading } = useToolCheck<DkimCheck>("/api/tools/dkim", FIELDS);
  const domain = values.domain ?? "";
  const grade = result ? GRADES[result.grade] : null;

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
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
        <Input
          value={values.selector ?? ""}
          onChange={(event) => setValue("selector", event.target.value)}
          placeholder="Selector (optional)"
          aria-label="Selector"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 text-base sm:text-sm"
        />
        <Button type="submit" size="lg" className="h-11 px-6" isLoading={loading} disabled={!domain.trim()}>
          <Search className="size-4" />
          Check DKIM
        </Button>
      </form>

      {error ? <ToolError message={error} /> : null}

      {result && grade ? (
        result.keys.length === 0 ? (
          <ToolResultCard
            subject={result.domain}
            summary={result.searched.length === 1 ? `No DKIM key at ${result.searched[0]}._domainkey.${result.domain}.` : grade.summary}
            badge={grade}
            findings={[
              {
                level: "problem",
                title: result.searched.length === 1 ? "Nothing at that selector" : "None of the common selectors have a key",
                detail:
                  result.searched.length === 1
                    ? "Check the selector is spelled the way your provider shows it."
                    : `We looked under ${result.searched.join(", ")}. If your provider uses a different selector, enter it above. You'll find it in the s= tag of a DKIM-Signature header on an email you've sent.`,
              },
            ]}
            cta={{ text: "ByteSend gives every domain a 2048-bit DKIM key and checks it stays published.", label: "Start free", href: "/signup" }}
          />
        ) : (
          <div className="space-y-4">
            {result.keys.map((key) => (
              <ToolResultCard
                key={key.selector}
                subject={`${key.selector}._domainkey.${result.domain}`}
                summary={GRADES[key.grade].summary}
                badge={GRADES[key.grade]}
                records={[{ label: `${key.keyType.toUpperCase()} key`, value: key.record }]}
                findings={key.findings}
                cta={{ text: "ByteSend gives every domain a 2048-bit DKIM key and checks it stays published.", label: "Start free", href: "/signup" }}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
