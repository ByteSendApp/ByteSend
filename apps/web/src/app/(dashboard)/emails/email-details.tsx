"use client";

import { UAParser } from "ua-parser-js";
import { api } from "~/trpc/react";
import Spinner from "@bytesend/ui/src/spinner";
import { Callout } from "@bytesend/ui/src/callout";
import { CopyButton } from "@bytesend/ui/src/copy-field";
import { KeyValueList } from "@bytesend/ui/src/panel";
import { EmailStatusBadge, EmailStatusIcon } from "./email-status-badge";
import { formatDate } from "date-fns";
import { EmailStatus } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import {
  SesBounce,
  SesClick,
  SesComplaint,
  SesDeliveryDelay,
  SesOpen,
} from "~/types/aws-types";
import {
  BOUNCE_ERROR_MESSAGES,
  COMPLAINT_ERROR_MESSAGES,
  DELIVERY_DELAY_ERRORS,
} from "@bytesend/lib/src/constants/ses-errors";
import CancelEmail from "./cancel-email";
import { useEffect, useState } from "react";

export default function EmailDetails({ emailId }: { emailId: string }) {
  const emailQuery = api.email.getEmail.useQuery({ id: emailId });
  const email = emailQuery.data;

  if (emailQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (!email) {
    return <p className="p-6 text-sm text-muted-foreground">This email couldn&apos;t be found.</p>;
  }

  const events = [...email.emailEvents].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  const isScheduled = email.latestStatus === "SCHEDULED" && email.scheduledAt;

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-1 no-scrollbar">
      <div className="space-y-1.5 pr-8">
        <EmailStatusBadge status={email.latestStatus ?? "SENT"} />
        <h2 className="text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {email.subject || "(no subject)"}
        </h2>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <KeyValueList
          items={[
            { label: "To", value: email.to.join(", ") },
            { label: "From", value: email.from },
            {
              label: isScheduled ? "Scheduled for" : "Sent",
              value: formatDate(isScheduled ? email.scheduledAt! : email.createdAt, "MMM d, yyyy 'at' HH:mm"),
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

      {isScheduled ? (
        <Callout tone="info" title="This email hasn't been sent yet" action={<CancelEmail emailId={emailId} />}>
          It goes out {formatDate(email.scheduledAt!, "MMM d 'at' HH:mm")}. Cancel it to stop it being sent.
        </Callout>
      ) : null}

      {!isScheduled && events.length ? (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground">Events</h3>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {events.map((evt) => (
              <li key={`${evt.status}-${String(evt.createdAt)}`} className="relative">
                <span className="absolute -left-[26.5px] top-0.5 rounded-full bg-background p-0.5">
                  <EmailStatusIcon status={evt.status} />
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EmailStatusBadge status={evt.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(evt.createdAt, "MMM d, HH:mm:ss")}</span>
                </div>
                <div className="mt-1.5 text-[13px] text-muted-foreground">
                  <EmailStatusText status={evt.status} data={evt.data} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">Content</h3>
        <EmailPreview html={email.html ?? ""} text={email.text ?? ""} />
      </section>
    </div>
  );
}

const EmailPreview = ({ html, text }: { html: string; text: string }) => {
  const [show, setShow] = useState(false);
  const [view, setView] = useState<"html" | "text">(html ? "html" : "text");

  // The iframe is mounted after the sheet's open animation, which it would otherwise stutter.
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {html && text ? (
        <div className="flex gap-1 border-b border-border bg-muted/30 p-1">
          {(["html", "text"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                view === option ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "html" ? "HTML" : "Plain text"}
            </button>
          ))}
        </div>
      ) : null}
      {view === "html" && html ? (
        <div className="h-96 bg-white">{show ? <iframe title="Email preview" className="size-full" srcDoc={html} sandbox="allow-same-origin" /> : null}</div>
      ) : (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-foreground">{text || "No plain-text version."}</pre>
      )}
    </div>
  );
};

export const EmailStatusText = ({
  status,
  data,
}: {
  status: EmailStatus;
  data: JsonValue;
}) => {
  if (status === "SENT") {
    return (
      <div>
        Accepted and handed to the recipient's mail server.
      </div>
    );
  } else if (status === "DELIVERED") {
    return <div>The recipient's mail server accepted it.</div>;
  } else if (status === "DELIVERY_DELAYED") {
    const _errorData = data as unknown as SesDeliveryDelay;
    const errorMessage = DELIVERY_DELAY_ERRORS[_errorData.delayType];

    return <div>{errorMessage}</div>;
  } else if (status === "BOUNCED") {
    const _errorData = data as unknown as SesBounce;
    _errorData.bounceType;

    return (
      <div className="flex flex-col gap-4 w-full">
        <p>{getErrorMessage(_errorData)}</p>
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="flex gap-2 w-full">
            <div className="w-1/2">
              <p className="text-[11px] text-muted-foreground">Type</p>
              <p>{_errorData.bounceType}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Sub Type</p>
              <p>{_errorData.bounceSubType}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">SMTP response</p>
            <p>{_errorData.bouncedRecipients[0]?.diagnosticCode}</p>
          </div>
        </div>
      </div>
    );
  } else if (status === "FAILED") {
    const _errorData = data as unknown as { error: string };
    return <div>{_errorData.error}</div>;
  } else if (status === "OPENED") {
    const _data = data as unknown as SesOpen;
    const userAgent = getUserAgent(_data.userAgent);

    return (
      <div className="mt-2 w-full rounded-md border border-border bg-muted/30 p-3 text-xs">
        <div className="flex  w-full ">
          {userAgent.os.name ? (
            <div className="w-1/2">
              <p className="text-[11px] text-muted-foreground">OS</p>
              <p>{userAgent.os.name}</p>
            </div>
          ) : null}
          {userAgent.browser.name ? (
            <div>
              <p className="text-[11px] text-muted-foreground">Browser</p>
              <p>{userAgent.browser.name}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  } else if (status === "CLICKED") {
    const _data = data as unknown as SesClick;
    const userAgent = getUserAgent(_data.userAgent);

    return (
      <div className="mt-2 flex w-full flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
        <div className="flex  w-full ">
          {userAgent.os.name ? (
            <div className="w-1/2">
              <p className="text-[11px] text-muted-foreground">OS </p>
              <p>{userAgent.os.name}</p>
            </div>
          ) : null}
          {userAgent.browser.name ? (
            <div>
              <p className="text-[11px] text-muted-foreground">Browser </p>
              <p>{userAgent.browser.name}</p>
            </div>
          ) : null}
        </div>
        <div className="w-full">
          <p className="text-[11px] text-muted-foreground">URL</p>
          <p className="break-all text-foreground">{_data.link}</p>
        </div>
      </div>
    );
  } else if (status === "COMPLAINED") {
    const _errorData = data as unknown as SesComplaint;

    return (
      <div className="flex flex-col gap-4 w-full">
        <p>{getComplaintMessage(_errorData.complaintFeedbackType)}</p>
      </div>
    );
  } else if (status === "CANCELLED") {
    return <div>This scheduled email was cancelled</div>;
  } else if (status === "SUPPRESSED") {
    return (
      <div>
        Not sent: this address bounced or marked an earlier email as spam, so it's on your suppression list.
      </div>
    );
  }

  return <div className="w-full">{status}</div>;
};

const getErrorMessage = (data: SesBounce) => {
  if (data.bounceType === "Permanent") {
    return BOUNCE_ERROR_MESSAGES[data.bounceType][
      data.bounceSubType as
        | "General"
        | "NoEmail"
        | "Suppressed"
        | "OnAccountSuppressionList"
    ];
  } else if (data.bounceType === "Transient") {
    return BOUNCE_ERROR_MESSAGES[data.bounceType][
      data.bounceSubType as
        | "General"
        | "MailboxFull"
        | "MessageTooLarge"
        | "ContentRejected"
        | "AttachmentRejected"
    ];
  } else if (data.bounceType === "Undetermined") {
    return BOUNCE_ERROR_MESSAGES.Undetermined;
  }
};

const getComplaintMessage = (errorType: string) => {
  return COMPLAINT_ERROR_MESSAGES[
    errorType as keyof typeof COMPLAINT_ERROR_MESSAGES
  ];
};

const getUserAgent = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  return {
    browser: parser.getBrowser(),
    os: parser.getOS(),
    device: parser.getDevice(),
  };
};
