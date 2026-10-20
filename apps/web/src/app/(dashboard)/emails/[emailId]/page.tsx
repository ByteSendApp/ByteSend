"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Mail, Monitor, Reply, Smartphone } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { CopyButton } from "@bytesend/ui/src/copy-field";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { KeyValueList, Panel } from "@bytesend/ui/src/panel";
import { useBreadcrumb } from "~/components/dashboard/breadcrumbs";
import { api } from "~/trpc/react";
import CancelEmail from "../cancel-email";
import { EmailStatusText } from "../email-details";
import { EmailStatusBadge, EmailStatusIcon } from "../email-status-badge";

const mono = (value: string) => <span className="font-mono text-xs font-normal">{value}</span>;

export default function EmailPage() {
  const { emailId } = useParams<{ emailId: string }>();
  const query = api.email.detail.useQuery({ id: emailId }, { retry: false });
  const email = query.data;
  useBreadcrumb(`/emails/${emailId}`, email ? email.subject || "(no subject)" : undefined);

  if (query.isLoading) return <ListSkeleton rows={8} />;
  if (!email) {
    return (
      <Panel flush>
        <EmptyState
          icon={<Mail />}
          title="Email not found"
          description="It may have been sent by another team, or the link is wrong."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/emails">Back to emails</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  const isScheduled = email.latestStatus === "SCHEDULED" && email.scheduledAt;
  const details = [
    { label: "From", value: email.from },
    { label: "To", value: email.to.join(", ") },
    ...(email.cc.length ? [{ label: "Cc", value: email.cc.join(", ") }] : []),
    ...(email.bcc.length ? [{ label: "Bcc", value: email.bcc.join(", ") }] : []),
    ...(email.replyTo.length ? [{ label: "Reply-To", value: email.replyTo.join(", ") }] : []),
    {
      label: isScheduled ? "Scheduled for" : "Created",
      value: formatDate(isScheduled ? email.scheduledAt! : email.createdAt, "MMM d, yyyy 'at' HH:mm:ss"),
    },
    ...(email.domain
      ? [{ label: "Domain", value: <Link href={`/domains/${email.domain.id}`} className="text-primary hover:underline">{email.domain.name}</Link> }]
      : []),
    ...(email.campaign
      ? [{ label: "Campaign", value: <Link href={`/campaigns/${email.campaign.id}`} className="text-primary hover:underline">{email.campaign.name}</Link> }]
      : []),
    ...(email.apiKey ? [{ label: "Sent with", value: `${email.apiKey.name}${email.apiKey.isTest ? " (test key)" : ""}` }] : []),
    {
      label: "Email ID",
      value: (
        <span className="inline-flex items-center gap-1">
          {mono(email.id)}
          <CopyButton value={email.id} />
        </span>
      ),
    },
    ...(email.sesEmailId
      ? [
          {
            label: "Message ID",
            value: (
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate">{mono(email.sesEmailId)}</span>
                <CopyButton value={email.sesEmailId} />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <Link href="/emails" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Emails
      </Link>
      <PageHeader
        title={<span className="[overflow-wrap:anywhere]">{email.subject || "(no subject)"}</span>}
        meta={
          <span className="flex items-center gap-1.5">
            <EmailStatusBadge status={email.latestStatus} />
            {email.isTest ? <Badge variant="warning">Test</Badge> : null}
          </span>
        }
        description={`To ${email.to.join(", ")} · ${formatDistanceToNow(email.createdAt, { addSuffix: true })}`}
      />

      {email.isTest ? (
        <Callout tone="warning" title="Sent with a test key">
          Nothing was delivered. The events below were simulated.
        </Callout>
      ) : null}
      {isScheduled ? (
        <Callout tone="info" title="This email hasn't been sent yet" action={<CancelEmail emailId={email.id} />}>
          It goes out {formatDate(email.scheduledAt!, "MMM d 'at' HH:mm")}. Cancel it to stop it being sent.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ContentPreview html={email.html ?? ""} text={email.text ?? ""} />

        <div className="space-y-5">
          <Panel flush title="Details">
            <KeyValueList items={details} />
          </Panel>

          {email.inReplyTo || email.replies.length ? (
            <Panel flush title="Conversation">
              <ul className="divide-y divide-border text-[13px]">
                {email.inReplyTo ? (
                  <li>
                    <Link href={`/emails/${email.inReplyTo.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40">
                      <Reply className="size-3.5 shrink-0 -scale-x-100 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-muted-foreground">In reply to </span>
                        {email.inReplyTo.subject || "(no subject)"}
                      </span>
                    </Link>
                  </li>
                ) : null}
                {email.replies.map((reply) => (
                  <li key={reply.id}>
                    <Link href={`/inbox?id=${reply.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40">
                      <Reply className="size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">{reply.fromName || reply.from}</span>
                        <span className="block truncate text-xs text-muted-foreground">{reply.subject || "(no subject)"}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(reply.receivedAt, { addSuffix: true })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Events">
            {email.events.length ? (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {email.events.map((event) => (
                  <li key={`${event.status}-${String(event.createdAt)}`} className="relative">
                    <span className="absolute -left-[26.5px] top-0.5 rounded-full bg-card p-0.5">
                      <EmailStatusIcon status={event.status} />
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <EmailStatusBadge status={event.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(event.createdAt, "MMM d, HH:mm:ss")}</span>
                    </div>
                    <div className="mt-1.5 text-[13px] text-muted-foreground">
                      <EmailStatusText status={event.status} data={event.data} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted-foreground">No events yet. They appear as the email is processed.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ContentPreview({ html, text }: { html: string; text: string }) {
  const [view, setView] = useState<"html" | "text">(html ? "html" : "text");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const toggle = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs font-medium transition-colors ${active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <Panel flush className="min-w-0">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 p-1">
        <div className="flex gap-1">
          {html ? (
            <button type="button" onClick={() => setView("html")} className={toggle(view === "html")}>
              HTML
            </button>
          ) : null}
          <button type="button" onClick={() => setView("text")} className={toggle(view === "text")}>
            Plain text
          </button>
        </div>
        {view === "html" ? (
          <div className="flex gap-1">
            <button type="button" aria-label="Desktop width" onClick={() => setWidth("desktop")} className={toggle(width === "desktop")}>
              <Monitor className="size-3.5" />
            </button>
            <button type="button" aria-label="Mobile width" onClick={() => setWidth("mobile")} className={toggle(width === "mobile")}>
              <Smartphone className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      {view === "html" && html ? (
        <div className="flex justify-center bg-muted/20">
          <iframe
            title="Email content"
            srcDoc={html}
            sandbox="allow-same-origin"
            className={`h-[70vh] min-h-[480px] bg-white transition-[width] ${width === "mobile" ? "w-[390px] max-w-full" : "w-full"}`}
          />
        </div>
      ) : (
        <pre className="max-h-[70vh] min-h-48 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-foreground">{text || "No plain-text version."}</pre>
      )}
    </Panel>
  );
}
