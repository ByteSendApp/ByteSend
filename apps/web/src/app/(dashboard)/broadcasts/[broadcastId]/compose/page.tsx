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
    DialogHeader,
    DialogTitle,
} from "@bytesend/ui/src/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@bytesend/ui/src/accordion";
import { toast } from "@bytesend/ui/src/toaster";
import { useDebouncedCallback } from "use-debounce";
import { formatDistanceToNow } from "date-fns";
import ScheduleCampaign from "../../../campaigns/schedule-campaign";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

function parseDirectRecipients(raw: string): string[] {
    return raw
        .split(/[\n,]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes("@"));
}

export default function BroadcastComposePage({
    params,
}: {
    params: Promise<{ broadcastId: string }>;
}) {
    const { broadcastId } = use(params);

    const {
        data: broadcast,
        isLoading,
        error,
    } = api.campaign.getCampaign.useQuery(
        { campaignId: broadcastId },
        { enabled: !!broadcastId },
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
                <p className="text-red-500">Failed to load broadcast</p>
            </div>
        );
    }

    if (!broadcast) {
        return <div>Broadcast not found</div>;
    }

    return <BroadcastComposer broadcast={broadcast} />;
}

function BroadcastComposer({
    broadcast,
}: {
    broadcast: Campaign & { contactBook: { id: string; name: string; emoji: string; _count?: { contacts: number } } | null; imageUploadSupported: boolean };
}) {
    const router = useRouter();
    const contactBooksQuery = api.contacts.getContactBooks.useQuery({});
    const utils = api.useUtils();

    const [json, setJson] = useState<Record<string, any> | undefined>(
        broadcast.content ? JSON.parse(broadcast.content) : undefined,
    );
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState(broadcast.name);
    const [subject, setSubject] = useState(broadcast.subject);
    const [from, setFrom] = useState(broadcast.from);
    const [replyTo, setReplyTo] = useState<string | undefined>(
        broadcast.replyTo[0],
    );

    const [recipientMode, setRecipientMode] = useState<"contactBook" | "direct">(
        broadcast.contactBookId ? "contactBook" : "direct",
    );
    const [contactBookId, setContactBookId] = useState<string | null | undefined>(
        broadcast.contactBookId,
    );
    const [directRecipients, setDirectRecipients] = useState<string>(
        broadcast.recipientEmails?.join("\n") ?? "",
    );

    const [sendNowOpen, setSendNowOpen] = useState(false);

    const updateCampaignMutation = api.campaign.updateCampaign.useMutation({
        onSuccess: () => {
            utils.campaign.getCampaign.invalidate();
            setIsSaving(false);
        },
    });

    const scheduleMutation = api.campaign.scheduleCampaign.useMutation();

    function updateEditorContent() {
        updateCampaignMutation.mutate({
            campaignId: broadcast.id,
            content: JSON.stringify(json),
        });
    }

    const debouncedUpdateCampaign = useDebouncedCallback(updateEditorContent, 1000);

    const handleFileChange = async (file: File) => {
        if (file.size > IMAGE_SIZE_LIMIT) {
            throw new Error(
                `File should be less than ${IMAGE_SIZE_LIMIT / 1024 / 1024}MB`,
            );
        }

        const fd = new FormData();
        fd.append("file", file);
        fd.append("teamId", String(broadcast.teamId));
        fd.append("type", "asset");

        const response = await fetch("/api/upload", { method: "POST", body: fd });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error((err as any)?.error ?? "Failed to upload file");
        }
        const { publicUrl } = (await response.json()) as { publicUrl: string };
        return publicUrl;
    };

    const contactBook = contactBooksQuery.data?.find(
        (book) => book.id === contactBookId,
    );

    const editorVariables = useMemo(() => {
        if (recipientMode === "direct") return [];
        const baseVariables = ["email", "firstName", "lastName"];
        const registryVariables = contactBook?.variables ?? [];
        return Array.from(new Set([...baseVariables, ...registryVariables]));
    }, [contactBook, recipientMode]);

    const parsedDirectEmails = useMemo(
        () => parseDirectRecipients(directRecipients),
        [directRecipients],
    );

    const recipientCount =
        recipientMode === "direct"
            ? parsedDirectEmails.length
            : contactBook?._count?.contacts ?? 0;

    async function saveAll() {
        if (recipientMode === "direct") {
            await new Promise<void>((resolve, reject) => {
                updateCampaignMutation.mutate(
                    {
                        campaignId: broadcast.id,
                        recipientEmails: parsedDirectEmails,
                        subject,
                        from,
                        replyTo: replyTo ? [replyTo] : [],
                    },
                    { onSuccess: () => resolve(), onError: reject },
                );
            });
        } else {
            await new Promise<void>((resolve, reject) => {
                updateCampaignMutation.mutate(
                    {
                        campaignId: broadcast.id,
                        contactBookId: contactBookId ?? undefined,
                        subject,
                        from,
                        replyTo: replyTo ? [replyTo] : [],
                    },
                    { onSuccess: () => resolve(), onError: reject },
                );
            });
        }
    }

    async function handleSendNow() {
        try {
            await saveAll();
        } catch {
            toast.error("Failed to save broadcast before sending");
            return;
        }
        scheduleMutation.mutate(
            { campaignId: broadcast.id },
            {
                onSuccess: () => {
                    toast.success("Broadcast sent!");
                    setSendNowOpen(false);
                    router.push(`/broadcasts/${broadcast.id}`);
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    return (
        <div className="flex flex-col h-full min-h-screen">
            {/* Sticky top bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 h-12 shrink-0 border-b border-border bg-background/95 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/broadcasts"
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border-0 focus:ring-0 focus:outline-none bg-transparent h-auto p-0 font-medium text-sm min-w-0"
                        onBlur={() => {
                            if (!name || name === broadcast.name) return;
                            updateCampaignMutation.mutate(
                                { campaignId: broadcast.id, name },
                                {
                                    onError: (e) => {
                                        toast.error(`${e.message}. Reverting changes.`);
                                        setName(broadcast.name);
                                    },
                                },
                            );
                        }}
                    />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {isSaving ? (
                            <div className="h-2 w-2 bg-yellow-400 rounded-full" />
                        ) : (
                            <div className="h-2 w-2 bg-green-500 rounded-full" />
                        )}
                        <span className="text-xs hidden sm:block">
                            {formatDistanceToNow(broadcast.updatedAt) === "less than a minute"
                                ? "just now"
                                : `${formatDistanceToNow(broadcast.updatedAt)} ago`}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSendNowOpen(true)}
                    >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send Now
                    </Button>
                    <ScheduleCampaign
                        campaign={broadcast}
                        onScheduled={() => router.push(`/broadcasts/${broadcast.id}`)}
                    />
                </div>
            </div>

            {/* Settings strip (accordion for broadcast fields) */}
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
                                    if (subject === broadcast.subject || !subject) {
                                        return;
                                    }
                                    updateCampaignMutation.mutate(
                                        {
                                            campaignId: broadcast.id,
                                            subject,
                                        },
                                        {
                                            onError: (e) => {
                                                toast.error(`${e.message}. Reverting changes.`);
                                                setSubject(broadcast.subject);
                                            },
                                        },
                                    );
                                }}
                                className="text-sm flex-1 outline-none border-b border-transparent focus:border-border bg-transparent py-0.5"
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
                                            if (from === broadcast.from || !from) {
                                                return;
                                            }
                                            updateCampaignMutation.mutate(
                                                {
                                                    campaignId: broadcast.id,
                                                    from,
                                                },
                                                {
                                                    onError: (e) => {
                                                        toast.error(`${e.message}. Reverting changes.`);
                                                        setFrom(broadcast.from);
                                                    },
                                                },
                                            );
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-xs text-muted-foreground w-16 shrink-0">Reply To</label>
                                    <input
                                        type="text"
                                        value={replyTo ?? ""}
                                        onChange={(e) => {
                                            setReplyTo(e.target.value);
                                        }}
                                        className="text-sm flex-1 outline-none border-b border-transparent bg-transparent focus:border-border py-0.5"
                                        placeholder="hello@example.com"
                                        onBlur={() => {
                                            if (replyTo === broadcast.replyTo[0]) {
                                                return;
                                            }
                                            updateCampaignMutation.mutate(
                                                {
                                                    campaignId: broadcast.id,
                                                    replyTo: replyTo ? [replyTo] : [],
                                                },
                                                {
                                                    onError: (e) => {
                                                        toast.error(`${e.message}. Reverting changes.`);
                                                        setReplyTo(broadcast.replyTo[0]);
                                                    },
                                                },
                                            );
                                        }}
                                    />
                                </div>

                                {/* Recipients section in accordion */}
                                <div className="pt-2 border-t border-border/70">
                                    <div className="flex items-center gap-4">
                                        <label className="text-xs text-muted-foreground w-16 shrink-0">Recipients</label>
                                        <div className="flex-1">
                                            {recipientMode === "contactBook" ? (
                                                contactBooksQuery.isLoading ? (
                                                    <Spinner className="w-4 h-4" />
                                                ) : (
                                                    <Select
                                                        value={contactBookId ?? ""}
                                                        onValueChange={(val) => {
                                                            setContactBookId(val);
                                                            updateCampaignMutation.mutate(
                                                                { campaignId: broadcast.id, contactBookId: val },
                                                                { onError: () => setContactBookId(broadcast.contactBookId) },
                                                            );
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full text-sm h-auto border-0 border-b border-transparent focus:border-border bg-transparent p-0">
                                                            {contactBook
                                                                ? `${contactBook.emoji} ${contactBook.name}`
                                                                : "Select a contact book"}
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {contactBooksQuery.data?.map((book) => (
                                                                <SelectItem key={book.id} value={book.id}>
                                                                    {book.emoji} {book.name}
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        {book._count.contacts} contacts
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    {parsedDirectEmails.length} recipient{parsedDirectEmails.length !== 1 ? "s" : ""}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Toggle between contact book and direct */}
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setRecipientMode("contactBook")}
                                            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${recipientMode === "contactBook"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            Contact Book
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRecipientMode("direct")}
                                            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${recipientMode === "direct"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            Direct
                                        </button>
                                    </div>

                                    {/* Direct recipients editor */}
                                    {recipientMode === "direct" && (
                                        <textarea
                                            placeholder={"One email per line, or comma-separated\nalice@example.com\nbob@example.com"}
                                            value={directRecipients}
                                            onChange={(e) => setDirectRecipients(e.target.value)}
                                            className="w-full h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary mt-2"
                                        />
                                    )}
                                </div>
                            </div>
                        </AccordionContent>
                    </div>
                </AccordionItem>
            </Accordion>

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
                    {recipientCount > 0 && (
                        <>
                            <span className="text-border/60">·</span>
                            <span className="text-muted-foreground">Sending to {recipientCount.toLocaleString()}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1">
                <div className="w-full">
                    <Editor
                        key={`broadcast-editor-${contactBookId ?? "none"}-${recipientMode}`}
                        initialContent={json}
                        onUpdate={(content) => {
                            setJson(content.getJSON());
                            setIsSaving(true);
                            debouncedUpdateCampaign();
                        }}
                        variables={editorVariables}
                        variableSuggestionsHelperText={
                            recipientMode === "direct"
                                ? "Variable substitution is not available for direct recipients"
                                : recipientMode === "contactBook" && !contactBookId
                                    ? "Select a contact book for variable suggestions"
                                    : undefined
                        }
                        uploadImage={
                            broadcast.imageUploadSupported ? handleFileChange : undefined
                        }
                    />
                </div>
            </div>

            {/* Send Now confirmation dialog */}
            <Dialog open={sendNowOpen} onOpenChange={setSendNowOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send broadcast now?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will immediately send to{" "}
                        <span className="font-semibold text-foreground">
                            {recipientCount}
                        </span>{" "}
                        recipient{recipientCount !== 1 ? "s" : ""}. This action cannot be
                        undone.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setSendNowOpen(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSendNow}
                            isLoading={scheduleMutation.isPending}
                            className="flex-1"
                        >
                            Send Now
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
