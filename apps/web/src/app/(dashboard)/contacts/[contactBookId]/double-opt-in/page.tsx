"use client";

import { Editor } from "@bytesend/email-editor";
import { Spinner } from "@bytesend/ui/src/spinner";
import { Input } from "@bytesend/ui/src/input";
import { toast } from "@bytesend/ui/src/toaster";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  DEFAULT_DOUBLE_OPT_IN_SUBJECT,
  DOUBLE_OPT_IN_EDITOR_VARIABLES,
  getDefaultDoubleOptInContent,
  hasDoubleOptInUrlPlaceholder,
} from "~/lib/constants/double-opt-in";
import { api } from "~/trpc/react";

const DOUBLE_OPT_IN_URL_REQUIRED_MESSAGE =
  "Double opt-in email content must include {{doubleOptInUrl}}.";

function parseEditorContent(content: string | null | undefined) {
  if (!content) {
    return getDefaultDoubleOptInContent();
  }

  try {
    return JSON.parse(content) as Record<string, any>;
  } catch {
    return getDefaultDoubleOptInContent();
  }
}

export default function DoubleOptInEditorPage({
  params,
}: {
  params: Promise<{ contactBookId: string }>;
}) {
  const { contactBookId } = use(params);

  const {
    data: contactBook,
    isLoading,
    error,
  } = api.contacts.getContactBookDetails.useQuery({
    contactBookId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red">Failed to load double opt-in settings</p>
      </div>
    );
  }

  if (!contactBook) {
    return <div>Contact book not found</div>;
  }

  return <DoubleOptInEditor contactBook={contactBook} />;
}

function DoubleOptInEditor({
  contactBook,
}: {
  contactBook: {
    id: string;
    name: string;
    updatedAt: Date;
    doubleOptInFrom: string | null;
    doubleOptInSubject: string | null;
    doubleOptInContent: string | null;
  };
}) {
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any>>(
    parseEditorContent(contactBook.doubleOptInContent),
  );
  const [subject, setSubject] = useState(
    contactBook.doubleOptInSubject ?? DEFAULT_DOUBLE_OPT_IN_SUBJECT,
  );
  const [from, setFrom] = useState(contactBook.doubleOptInFrom ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const hasShownMissingPlaceholderToast = useRef(false);

  const updateContactBook = api.contacts.updateContactBook.useMutation({
    onSuccess: async () => {
      await utils.contacts.getContactBookDetails.invalidate({
        contactBookId: contactBook.id,
      });
      setIsSaving(false);
    },
  });

  function updateContent(contentValue: string) {
    updateContactBook.mutate(
      {
        contactBookId: contactBook.id,
        doubleOptInContent: contentValue,
      },
      {
        onError: (error) => {
          toast.error(error.message);
          setIsSaving(false);
        },
      },
    );
  }

  const debouncedUpdateContent = useDebouncedCallback(updateContent, 1000);

  return (
    <div className="h-full min-h-full flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/contacts/${contactBook.id}`} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-none mb-0.5">Double opt-in email</div>
            <div className="text-sm font-medium truncate">{contactBook.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          {isSaving ? (
            <div className="h-2 w-2 bg-yellow rounded-full" />
          ) : (
            <div className="h-2 w-2 bg-green rounded-full" />
          )}
          <span className="text-xs hidden sm:block">
            {formatDistanceToNow(contactBook.updatedAt) === "less than a minute"
              ? "just now"
              : `${formatDistanceToNow(contactBook.updatedAt)} ago`}
          </span>
        </div>
      </div>

      {/* Settings strip */}
      <div className="border-b border-border bg-muted/20 px-4 sm:px-6 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-4">
          <label className="text-xs text-muted-foreground w-16 shrink-0">Subject</label>
          <Input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
            }}
            onBlur={() => {
              const normalizedSubject =
                subject.trim() || DEFAULT_DOUBLE_OPT_IN_SUBJECT;
              const currentSubject =
                contactBook.doubleOptInSubject ??
                DEFAULT_DOUBLE_OPT_IN_SUBJECT;

              if (normalizedSubject === currentSubject) {
                return;
              }

              setIsSaving(true);
              updateContactBook.mutate(
                {
                  contactBookId: contactBook.id,
                  doubleOptInSubject: normalizedSubject,
                },
                {
                  onError: (error) => {
                    toast.error(error.message);
                    setIsSaving(false);
                    setSubject(
                      contactBook.doubleOptInSubject ??
                        DEFAULT_DOUBLE_OPT_IN_SUBJECT,
                    );
                  },
                },
              );
            }}
            className="text-sm flex-1 outline-none border-b border-transparent focus:border-border bg-transparent py-0.5 h-auto"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs text-muted-foreground w-16 shrink-0">From</label>
          <Input
            type="text"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
            onBlur={() => {
              const normalizedFrom = from.trim();
              const currentFrom = contactBook.doubleOptInFrom ?? "";

              if (normalizedFrom === currentFrom) {
                return;
              }

              setIsSaving(true);
              updateContactBook.mutate(
                {
                  contactBookId: contactBook.id,
                  doubleOptInFrom: normalizedFrom || null,
                },
                {
                  onError: (error) => {
                    toast.error(error.message);
                    setIsSaving(false);
                    setFrom(contactBook.doubleOptInFrom ?? "");
                  },
                },
              );
            }}
            placeholder="Friendly name<hello@example.com>"
            className="text-sm flex-1 outline-none border-b border-transparent focus:border-border bg-transparent py-0.5 h-auto"
          />
        </div>
      </div>

      {/* Hints strip */}
      <div className="border-b border-border bg-background px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Required: <code className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-[11px]">{"{{doubleOptInUrl}}"}</code></span>
          <span className="text-border/60">·</span>
          <span>Type <code className="font-mono bg-muted px-1 py-0.5 rounded border border-border text-[11px]">/</code> in editor for blocks</span>
        </div>
      </div>

      {/* Email canvas */}
      <div className="flex-1">
        <div className="w-full">
          <Editor
            initialContent={json}
            onUpdate={(content) => {
              const nextContent = content.getJSON();
              const serializedContent = JSON.stringify(nextContent);

              setJson(nextContent);

              if (!hasDoubleOptInUrlPlaceholder(serializedContent)) {
                debouncedUpdateContent.cancel();
                setIsSaving(false);

                if (!hasShownMissingPlaceholderToast.current) {
                  toast.error(DOUBLE_OPT_IN_URL_REQUIRED_MESSAGE);
                  hasShownMissingPlaceholderToast.current = true;
                }

                return;
              }

              hasShownMissingPlaceholderToast.current = false;
              setIsSaving(true);
              debouncedUpdateContent(serializedContent);
            }}
            variables={DOUBLE_OPT_IN_EDITOR_VARIABLES}
          />
        </div>
      </div>
    </div>
  );
}
