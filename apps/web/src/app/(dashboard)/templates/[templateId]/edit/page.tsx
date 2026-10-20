"use client";

import { api } from "~/trpc/react";
import { Spinner } from "@bytesend/ui/src/spinner";
import { Input } from "@bytesend/ui/src/input";
import { Editor } from "@bytesend/email-editor";
import { useState } from "react";
import { Template } from "@prisma/client";
import { toast } from "@bytesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);

  const {
    data: template,
    isLoading,
    error,
  } = api.template.getTemplate.useQuery(
    { templateId: templateId },
    {
      enabled: !!templateId,
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
        <p className="text-red">Failed to load template</p>
      </div>
    );
  }

  if (!template) {
    return <div>Template not found</div>;
  }

  return <TemplateEditor template={template} />;
}

function TemplateEditor({
  template,
}: {
  template: Template & { imageUploadSupported: boolean };
}) {
  const utils = api.useUtils();

  const [json, setJson] = useState<Record<string, any> | undefined>(
    template.content ? JSON.parse(template.content) : undefined,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);

  const updateTemplateMutation = api.template.updateTemplate.useMutation({
    onSuccess: () => {
      utils.template.getTemplate.invalidate();
      setIsSaving(false);
    },
  });

  function updateEditorContent() {
    updateTemplateMutation.mutate({
      templateId: template.id,
      content: JSON.stringify(json),
    });
  }

  const deboucedUpdateTemplate = useDebouncedCallback(
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
    fd.append("teamId", String(template.teamId));
    fd.append("type", "asset");

    const response = await fetch("/api/upload", { method: "POST", body: fd });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any)?.error ?? "Failed to upload file");
    }
    const { publicUrl } = await response.json() as { publicUrl: string };
    return publicUrl;
  };

  return (
    <div className="h-full min-h-full flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/templates" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-0 focus:ring-0 focus:outline-none bg-transparent h-auto p-0 font-medium text-sm min-w-0"
            onBlur={() => {
              if (name === template.name || !name) {
                return;
              }
              updateTemplateMutation.mutate(
                {
                  templateId: template.id,
                  name,
                },
                {
                  onError: (e) => {
                    toast.error(`${e.message}. Reverting changes.`);
                    setName(template.name);
                  },
                },
              );
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          {isSaving ? (
            <div className="h-2 w-2 bg-yellow rounded-full" />
          ) : (
            <div className="h-2 w-2 bg-green rounded-full" />
          )}
          <span className="text-xs hidden sm:block">
            {formatDistanceToNow(template.updatedAt) === "less than a minute"
              ? "just now"
              : `${formatDistanceToNow(template.updatedAt)} ago`}
          </span>
        </div>
      </div>

      {/* Settings strip */}
      <div className="border-b border-border bg-muted/20 px-4 sm:px-6 pt-4 pb-3 overflow-x-auto">
        <div className="flex items-center gap-4 min-w-0">
          <label className="text-xs text-muted-foreground w-16 shrink-0">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
            }}
            onBlur={() => {
              if (subject === template.subject || !subject) {
                return;
              }
              updateTemplateMutation.mutate(
                {
                  templateId: template.id,
                  subject,
                },
                {
                  onError: (e) => {
                    toast.error(`${e.message}. Reverting changes.`);
                    setSubject(template.subject);
                  },
                },
              );
            }}
            className="text-sm leading-6 h-8 flex-1 outline-none border-b border-transparent focus:border-border bg-transparent"
          />
        </div>
      </div>

      {/* Variables + hints strip */}
      <div className="border-b border-border bg-background px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60">Variables:</span>
          {["{{email}}", "{{firstName}}", "{{lastName}}"].map((v) => (
            <code key={v} className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-[11px]">{v}</code>
          ))}
          <span className="text-border/60">·</span>
          <span>Type <code className="font-mono bg-muted px-1 py-0.5 rounded border border-border text-[11px]">/</code> for blocks</span>
          <span className="text-border/60 hidden sm:inline">·</span>
          <span className="hidden sm:inline">Use <code className="font-mono bg-muted px-1 py-0.5 rounded border border-border text-[11px]">{"{{var,fallback=Default}}"}</code> for fallbacks</span>
        </div>
      </div>

      {/* Email canvas */}
      <div className="flex-1">
        <div className="w-full">
          <Editor
            initialContent={json}
            onUpdate={(content) => {
              setJson(content.getJSON());
              setIsSaving(true);
              deboucedUpdateTemplate();
            }}
            variables={["email", "firstName", "lastName"]}
            uploadImage={
              template.imageUploadSupported ? handleFileChange : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
