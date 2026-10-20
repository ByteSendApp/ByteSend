"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "date-fns";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { Badge, type BadgeProps } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { CopyButton } from "@bytesend/ui/src/copy-field";
import { KeyValueList } from "@bytesend/ui/src/panel";
import Spinner from "@bytesend/ui/src/spinner";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

function verdictVariant(value?: string | null): BadgeProps["variant"] {
  if (value === "pass") return "success";
  if (value === "fail") return "danger";
  if (!value || value === "disabled") return "neutral";
  return "warning";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function InboundEmailDetails({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [view, setView] = useState<"html" | "text" | "headers">("html");
  const utils = api.useUtils();
  const query = api.inbound.get.useQuery({ id });
  const remove = api.inbound.delete.useMutation({
    onSuccess: async () => {
      toast.success("Email deleted");
      await utils.inbound.list.invalidate();
      onDeleted();
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }
  const email = query.data;
  if (!email) return <p className="p-6 text-sm text-muted-foreground">This email couldn&apos;t be found. It may have expired.</p>;

  const activeView = view === "html" && !email.html ? "text" : view;
  const auth = email.authentication;

  return (
    <div className="flex h-full flex-col gap-5 p-1">
      <div className="space-y-1.5 pr-8">
        <h2 className="text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{email.subject || "(no subject)"}</h2>
        <p className="text-[13px] text-muted-foreground">
          {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
        </p>
      </div>

      {auth.virus === "fail" ? (
        <Callout tone="danger" title="This message contains a virus">
          Don&apos;t open its attachments. It wasn&apos;t forwarded.
        </Callout>
      ) : null}
      {email.status === "FAILED" && email.error ? <Callout tone="warning">{email.error}</Callout> : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <KeyValueList
          items={[
            { label: "To", value: email.recipient },
            ...(email.cc.length ? [{ label: "Cc", value: email.cc.join(", ") }] : []),
            { label: "Received", value: formatDate(email.receivedAt, "MMM d, yyyy 'at' HH:mm") },
            ...(email.inReplyToEmailId
              ? [{ label: "Replying to", value: <Link href={`/emails/${email.inReplyToEmailId}`} className="text-primary hover:underline">an email you sent</Link> }]
              : []),
            ...(email.forwardedTo.length ? [{ label: "Forwarded to", value: email.forwardedTo.join(", ") }] : []),
            {
              label: "Checks",
              value: (
                <span className="flex flex-wrap justify-end gap-1">
                  {(["spf", "dkim", "dmarc", "spam", "virus"] as const).map((key) => (
                    <Badge key={key} variant={verdictVariant(auth[key])} className="uppercase">
                      {key} {auth[key] ?? "–"}
                    </Badge>
                  ))}
                </span>
              ),
            },
            {
              label: "Email ID",
              value: (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-normal">
                  {email.id}
                  <CopyButton value={email.id} />
                </span>
              ),
            },
          ]}
        />
      </div>

      {email.attachments.length ? (
        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-foreground">Attachments</h3>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
            {email.attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
                {attachment.url ? (
                  <Button asChild size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-foreground">
                    <a href={attachment.url} aria-label={`Download ${attachment.filename}`}>
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
          {(["html", "text", "headers"] as const)
            .filter((option) => option !== "html" || email.html)
            .map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded px-2 py-0.5 font-medium capitalize transition-colors ${
                  activeView === option ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "html" ? "HTML" : option}
              </button>
            ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {activeView === "html" && email.html ? (
            <div className="h-96 bg-white">
              <iframe title="Received email" className="size-full" srcDoc={email.html} sandbox="" />
            </div>
          ) : activeView === "headers" ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-foreground">
              {email.headers.map((h) => `${h.name}: ${h.value}`).join("\n")}
            </pre>
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-foreground">{email.text || "No plain-text version."}</pre>
          )}
        </div>
      </section>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>Deleted automatically {formatDate(email.expiresAt, "MMM d")}</span>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate({ id })} disabled={remove.isPending}>
          <Trash2 className="size-3.5" />
          Delete now
        </Button>
      </div>
    </div>
  );
}
