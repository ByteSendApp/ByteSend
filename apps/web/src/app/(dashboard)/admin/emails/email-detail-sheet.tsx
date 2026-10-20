"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@bytesend/ui/src/sheet";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { EmailStatusBadge } from "../../emails/email-status-badge";
import { EmailStatusText } from "../../emails/email-details";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function AddressList({ addresses }: { addresses: string[] }) {
  if (addresses.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono text-xs">{addresses.join(", ")}</span>;
}

export function EmailDetailSheet({ emailId, onClose }: { emailId: string | null; onClose: () => void }) {
  const [content, setContent] = useState<{ html: string | null; text: string | null } | null>(null);
  const utils = api.useUtils();

  const emailQuery = api.admin.getEmail.useQuery({ emailId: emailId ?? "" }, { enabled: emailId !== null });
  const email = emailQuery.data;

  const viewContent = api.admin.viewEmailContent.useMutation({
    onSuccess: (result) => {
      setContent(result);
      void utils.admin.listAuditLog.invalidate();
    },
    onError: (error) => toast.error("Could not load content", { description: error.message }),
  });

  return (
    <Sheet
      open={emailId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setContent(null);
          onClose();
        }
      }}
    >
      <SheetContent className="overflow-y-auto sm:w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6">{email?.subject || (emailQuery.isLoading ? "Loading…" : "(no subject)")}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{emailId}</SheetDescription>
        </SheetHeader>

        {emailQuery.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !email ? (
          <p className="mt-6 text-sm text-muted-foreground">{emailQuery.error?.message ?? "Email not found"}</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <EmailStatusBadge status={email.latestStatus} />
              <Link href={`/admin/teams/${email.team.id}`} className="text-sm font-medium hover:underline">
                {email.team.name}
              </Link>
              <span className="text-xs text-muted-foreground">{email.team.plan}</span>
            </div>

            <dl className="divide-y divide-border/60 rounded-lg border border-border/60 px-3">
              <Field label="From">
                <span className="font-mono text-xs">{email.from}</span>
              </Field>
              <Field label="To">
                <AddressList addresses={email.to} />
              </Field>
              {email.cc.length ? (
                <Field label="Cc">
                  <AddressList addresses={email.cc} />
                </Field>
              ) : null}
              {email.bcc.length ? (
                <Field label="Bcc">
                  <AddressList addresses={email.bcc} />
                </Field>
              ) : null}
              {email.replyTo.length ? (
                <Field label="Reply-To">
                  <AddressList addresses={email.replyTo} />
                </Field>
              ) : null}
              <Field label="Created">{format(email.createdAt, "yyyy-MM-dd HH:mm:ss")}</Field>
              {email.scheduledAt ? (
                <Field label="Scheduled">{format(email.scheduledAt, "yyyy-MM-dd HH:mm:ss")}</Field>
              ) : null}
              <Field label="Source">
                {email.campaignId ? (
                  <span>
                    Campaign <span className="font-mono text-xs">{email.campaignId}</span>
                  </span>
                ) : email.apiId ? (
                  <span>API key #{email.apiId}</span>
                ) : (
                  <span>Dashboard / SMTP</span>
                )}
              </Field>
              {email.sesEmailId ? (
                <Field label="SES ID">
                  <span className="font-mono text-xs">{email.sesEmailId}</span>
                </Field>
              ) : null}
            </dl>

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Timeline</h4>
              {email.emailEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border/60 pl-5">
                  {email.emailEvents.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-muted-foreground/60 ring-4 ring-background" />
                      <div className="flex flex-wrap items-center gap-2">
                        <EmailStatusBadge status={event.status} />
                        <span className="text-xs text-muted-foreground">
                          {format(event.createdAt, "yyyy-MM-dd HH:mm:ss")}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        <EmailStatusText status={event.status} data={event.data} />
                      </div>
                      {event.data ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Raw event
                          </summary>
                          <pre className="mt-1.5 max-h-60 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px]">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Content</h4>
              {content ? (
                content.html ? (
                  <div className="h-96 overflow-hidden rounded-lg border border-border/60 bg-white">
                    <iframe title="Email content" className="size-full" srcDoc={content.html} sandbox="" />
                  </div>
                ) : content.text ? (
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 p-3 text-xs">
                    {content.text}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">The body is no longer stored (removed by retention cleanup).</p>
                )
              ) : (
                <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    Message bodies are customer data. Viewing one is recorded in the audit log.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={viewContent.isPending}
                    onClick={() => viewContent.mutate({ emailId: email.id })}
                  >
                    <Eye className="mr-1.5 size-4" />
                    {viewContent.isPending ? "Loading…" : "View content"}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
