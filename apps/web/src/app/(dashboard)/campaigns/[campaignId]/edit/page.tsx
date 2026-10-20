"use client";

import { api } from "~/trpc/react";
import { Spinner } from "@bytesend/ui/src/spinner";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { Editor } from "@bytesend/email-editor";
import { use, useMemo, useState } from "react";
import { Campaign } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bytesend/ui/src/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bytesend/ui/src/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bytesend/ui/src/form";
import { toast } from "@bytesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bytesend/ui/src/accordion";
import ScheduleCampaign from "../../schedule-campaign";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const sendSchema = z.object({
  confirmation: z.string(),
});

const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);

  const {
    data: campaign,
    isLoading,
    error,
  } = api.campaign.getCampaign.useQuery(
    { campaignId },
    {
      enabled: !!campaignId,
    },
  );

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
        <p className="text-red">Failed to load campaign</p>
      </div>
    );
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  return <CampaignEditor campaign={campaign} />;
}

function CampaignEditor({
  campaign,
}: {
  campaign: Campaign & { imageUploadSupported: boolean };
}) {
  const router = useRouter();
  const isApiCampaign = campaign.isApi;
  const basePath = campaign.intent === "BROADCAST" ? "/broadcasts" : "/campaigns";
  const contactBooksQuery = api.contacts.getContactBooks.useQuery({});
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any> | undefined>(
    campaign.content ? JSON.parse(campaign.content) : undefined,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [from, setFrom] = useState(campaign.from);
  const [contactBookId, setContactBookId] = useState(campaign.contactBookId);
  const [replyTo, setReplyTo] = useState<string | undefined>(
    campaign.replyTo[0],
  );
  const [previewText, setPreviewText] = useState<string | null>(
    campaign.previewText,
  );

  const updateCampaignMutation = api.campaign.updateCampaign.useMutation({
    onSuccess: () => {
      utils.campaign.getCampaign.invalidate();
      setIsSaving(false);
    },
  });

  function updateEditorContent() {
    if (isApiCampaign) {
      return;
    }
    updateCampaignMutation.mutate({
      campaignId: campaign.id,
      content: JSON.stringify(json),
    });
  }

  const deboucedUpdateCampaign = useDebouncedCallback(
    updateEditorContent,
    1000,
  );

  const handleFileChange = async (file: File) => {
    if (file.size > IMAGE_SIZE_LIMIT) {
      throw new Error(
        `File should be less than ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB`,
      );
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("teamId", String(campaign.teamId));
    fd.append("type", "asset");

    const response = await fetch("/api/upload", { method: "POST", body: fd });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any)?.error ?? "Failed to upload file");
    }
    const { publicUrl } = await response.json() as { publicUrl: string };
    return publicUrl;
  };

  const contactBook = contactBooksQuery.data?.find(
    (book) => book.id === contactBookId,
  );
  const editorVariables = useMemo(() => {
    const baseVariables = ["email", "firstName", "lastName"];
    const registryVariables = contactBook?.variables ?? [];

    return Array.from(new Set([...baseVariables, ...registryVariables]));
  }, [contactBook]);
  const variableSuggestionsHelperText = contactBookId
    ? undefined
    : "Select the contact book for related variable";

  return (
    <div className="h-full min-h-full flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={basePath} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-0 focus:ring-0 focus:outline-none bg-transparent h-auto p-0 font-medium text-sm min-w-0"
            disabled={isApiCampaign}
            readOnly={isApiCampaign}
            onBlur={() => {
              if (isApiCampaign) {
                return;
              }
              if (name === campaign.name || !name) {
                return;
              }
              updateCampaignMutation.mutate(
                {
                  campaignId: campaign.id,
                  name,
                },
                {
                  onError: (e) => {
                    toast.error(`${e.message}. Reverting changes.`);
                    setName(campaign.name);
                  },
                },
              );
            }}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isSaving ? (
              <div className="h-2 w-2 bg-yellow rounded-full" />
            ) : (
              <div className="h-2 w-2 bg-green rounded-full" />
            )}
            <span className="text-xs hidden sm:block">
              {formatDistanceToNow(campaign.updatedAt) === "less than a minute"
                ? "just now"
                : `${formatDistanceToNow(campaign.updatedAt)} ago`}
            </span>
          </div>
          <ScheduleCampaign
            campaign={campaign}
            onScheduled={() => {
              router.push(`${basePath}/${campaign.id}`);
            }}
          />
        </div>
      </div>

      {/* Settings strip (accordion for extra fields) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-0">
          <div className="border-b border-border bg-muted/20 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              <label className="text-xs text-muted-foreground w-16 shrink-0">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                }}
                onBlur={() => {
                  if (isApiCampaign) {
                    return;
                  }
                  if (subject === campaign.subject || !subject) {
                    return;
                  }
                  updateCampaignMutation.mutate(
                    {
                      campaignId: campaign.id,
                      subject,
                    },
                    {
                      onError: (e) => {
                        toast.error(`${e.message}. Reverting changes.`);
                        setSubject(campaign.subject);
                      },
                    },
                  );
                }}
                className="text-sm flex-1 outline-none border-b border-transparent focus:border-border bg-transparent py-0.5"
                disabled={isApiCampaign}
                readOnly={isApiCampaign}
              />
              <AccordionTrigger className="py-0 shrink-0" />
            </div>
            <AccordionContent className="pb-0">
              <div className="flex flex-col gap-3 pt-3">
                <div className="flex items-center gap-4">
                  <label className="text-xs text-muted-foreground w-16 shrink-0">From</label>
                  <input
                    type="text"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                    }}
                    className="text-sm flex-1 outline-none border-b border-transparent focus:border-border bg-transparent py-0.5"
                    placeholder="Friendly name<hello@example.com>"
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (from === campaign.from || !from) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          from,
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Reverting changes.`);
                            setFrom(campaign.from);
                          },
                        },
                      );
                    }}
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-muted-foreground w-16 shrink-0">Reply To</label>
                  <input
                    type="text"
                    value={replyTo}
                    onChange={(e) => {
                      setReplyTo(e.target.value);
                    }}
                    className="text-sm flex-1 outline-none border-b border-transparent bg-transparent focus:border-border py-0.5"
                    placeholder="hello@example.com"
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (replyTo === campaign.replyTo[0]) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          replyTo: replyTo ? [replyTo] : [],
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Reverting changes.`);
                            setReplyTo(campaign.replyTo[0]);
                          },
                        },
                      );
                    }}
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-muted-foreground w-16 shrink-0">Preview</label>
                  <input
                    type="text"
                    value={previewText ?? undefined}
                    onChange={(e) => {
                      setPreviewText(e.target.value);
                    }}
                    onBlur={() => {
                      if (isApiCampaign) {
                        return;
                      }
                      if (
                        previewText === campaign.previewText ||
                        !previewText
                      ) {
                        return;
                      }
                      updateCampaignMutation.mutate(
                        {
                          campaignId: campaign.id,
                          previewText,
                        },
                        {
                          onError: (e) => {
                            toast.error(`${e.message}. Reverting changes.`);
                            setPreviewText(campaign.previewText ?? "");
                          },
                        },
                      );
                    }}
                    className="text-sm flex-1 outline-none border-b border-transparent bg-transparent focus:border-border py-0.5"
                    disabled={isApiCampaign}
                    readOnly={isApiCampaign}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-muted-foreground w-16 shrink-0">To</label>
                  {contactBooksQuery.isLoading ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Select
                      value={contactBookId ?? ""}
                      disabled={isApiCampaign}
                      onValueChange={(val) => {
                        if (isApiCampaign) {
                          return;
                        }
                        // Update the campaign's contactBookId
                        updateCampaignMutation.mutate(
                          {
                            campaignId: campaign.id,
                            contactBookId: val,
                          },
                          {
                            onError: () => {
                              setContactBookId(campaign.contactBookId);
                            },
                          },
                        );
                        setContactBookId(val);
                      }}
                    >
                      <SelectTrigger className="w-75">
                        {contactBook
                          ? `${contactBook.emoji} ${contactBook.name}`
                          : "Select a contact book"}
                      </SelectTrigger>
                      <SelectContent>
                        {contactBooksQuery.data?.map((book) => (
                          <SelectItem key={book.id} value={book.id}>
                            {book.emoji} {book.name}{" "}
                            <span className="text-xs text-muted-foreground ml-4">
                              {" "}
                              {book._count.contacts} contacts
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </AccordionContent>
          </div>
        </AccordionItem>
      </Accordion>

      {isApiCampaign ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">
            Email created from API. Campaign content can only be updated via API.
          </p>
        </div>
      ) : (
        <>
          {/* Variables strip */}
          <div className="border-b border-border bg-background px-4 sm:px-6 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/60">Variables:</span>
              {editorVariables.slice(0, 6).map((v) => (
                <code key={v} className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-[11px]">{`{{${v}}}`}</code>
              ))}
              {editorVariables.length > 6 && (
                <span className="text-muted-foreground/60">+{editorVariables.length - 6} more</span>
              )}
              <span className="text-border/60">·</span>
              <span className="hidden sm:inline">Required: <code className="font-mono bg-muted px-1 py-0.5 rounded border border-border text-[11px]">{"{{bytesend_unsubscribe_url}}"}</code></span>
            </div>
          </div>

          {/* Email canvas */}
          <div className="flex-1">
            <div className="w-full">
              <Editor
                key={`campaign-editor-${contactBookId ?? "none"}-${editorVariables.join(",")}`}
                initialContent={json}
                onUpdate={(content) => {
                  setJson(content.getJSON());
                  setIsSaving(true);
                  deboucedUpdateCampaign();
                }}
                variables={editorVariables}
                variableSuggestionsHelperText={variableSuggestionsHelperText}
                uploadImage={
                  campaign.imageUploadSupported ? handleFileChange : undefined
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
