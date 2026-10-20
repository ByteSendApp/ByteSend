"use client";

import { api } from "~/trpc/react";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { KeyValueList, Panel, SettingRow } from "@bytesend/ui/src/panel";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { CopyButton } from "@bytesend/ui/src/copy-field";
import { useBreadcrumb } from "~/components/dashboard/breadcrumbs";
import Link from "next/link";
import AddContact from "./add-contact";
import BulkUploadContacts from "./bulk-upload-contacts";
import ContactList from "./contact-list";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker, { Theme } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bytesend/ui/src/popover";
import { Button } from "@bytesend/ui/src/button";
import { Switch } from "@bytesend/ui/src/switch";
import { useTheme } from "@bytesend/ui";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Megaphone, MoreVertical, Plus, Trash2, Upload } from "lucide-react";
import EditContactBook from "../edit-contact-book";
import DeleteContactBook from "../delete-contact-book";

function ContactBookDetailActions({
  contactBookId,
  contactBookName,
  contactBookVariables,
}: {
  contactBookId: string;
  contactBookName?: string;
  contactBookVariables?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const utils = api.useUtils();
  const router = useRouter();

  return (
    <>
      <Button size="sm" onClick={() => setIsAddOpen(true)}>
        <Plus className="size-3.5" />
        Add contacts
      </Button>
      <Button size="sm" variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
        <Upload className="size-3.5" />
        Import CSV
      </Button>
      {contactBookName ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline" className="size-8" aria-label="More actions">
              <MoreVertical className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start font-normal"
                onClick={() => {
                  setOpen(false);
                  setIsEditOpen(true);
                }}
              >
                <Edit className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start font-normal text-destructive hover:text-destructive"
                onClick={() => {
                  setOpen(false);
                  setIsDeleteOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <AddContact
        contactBookId={contactBookId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
      />
      <BulkUploadContacts
        contactBookId={contactBookId}
        contactBookVariables={contactBookVariables}
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
      />
      {contactBookName ? (
        <EditContactBook
          contactBook={{
            id: contactBookId,
            name: contactBookName,
            variables: contactBookVariables,
          }}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSuccess={() =>
            utils.contacts.getContactBookDetails.invalidate({ contactBookId })
          }
        />
      ) : null}
      {contactBookName ? (
        <DeleteContactBook
          contactBook={{ id: contactBookId, name: contactBookName }}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onSuccess={async () => {
            await utils.contacts.getContactBookDetails.invalidate({
              contactBookId,
            });
            router.push("/contacts");
          }}
        />
      ) : null}
    </>
  );
}

export default function ContactsPage({
  params,
}: {
  params: Promise<{ contactBookId: string }>;
}) {
  const { contactBookId } = use(params);
  const { theme } = useTheme();

  const contactBookDetailQuery = api.contacts.getContactBookDetails.useQuery({
    contactBookId: contactBookId,
  });

  const utils = api.useUtils();

  const updateContactBookMutation = api.contacts.updateContactBook.useMutation({
    onMutate: async (data) => {
      await utils.contacts.getContactBookDetails.cancel();
      utils.contacts.getContactBookDetails.setData(
        {
          contactBookId: contactBookId,
        },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            ...data,
          };
        },
      );
    },
    onSettled: () => {
      utils.contacts.getContactBookDetails.invalidate({
        contactBookId: contactBookId,
      });
    },
  });

  const book = contactBookDetailQuery.data;
  useBreadcrumb(`/contacts/${contactBookId}`, book?.name);

  const subscribed = book ? book.totalContacts - book.unsubscribedContacts : undefined;
  const fmt = (n: number | undefined) => (n === undefined ? "–" : n.toLocaleString());

  return (
    <div className="space-y-5">
      <PageHeader
        icon={
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-lg leading-none" aria-label="Change emoji">
                {book?.emoji || "📋"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-full rounded-none border-0 bg-transparent! p-0! shadow-none drop-shadow-md">
              <EmojiPicker
                onEmojiClick={(emojiObject) => updateContactBookMutation.mutate({ contactBookId, emoji: emojiObject.emoji })}
                theme={theme === "system" ? Theme.AUTO : theme === "dark" ? Theme.DARK : Theme.LIGHT}
              />
            </PopoverContent>
          </Popover>
        }
        title={book?.name ?? "Contact book"}
        description={book ? `Created ${formatDistanceToNow(book.createdAt, { addSuffix: true })}` : undefined}
        actions={
          <ContactBookDetailActions contactBookId={contactBookId} contactBookName={book?.name} contactBookVariables={book?.variables} />
        }
      />

      <StatGroup>
        <Stat label="Contacts" value={fmt(book?.totalContacts)} />
        <Stat label="Subscribed" value={fmt(subscribed)} hint="Will receive broadcasts" />
        <Stat
          label="Unsubscribed"
          value={fmt(book?.unsubscribedContacts)}
          hint={book && book.totalContacts > 0 ? `${((book.unsubscribedContacts / book.totalContacts) * 100).toFixed(1)}% of the list` : undefined}
        />
        <Stat label="Double opt-in" value={book?.doubleOptInEnabled ? "On" : "Off"} hint={book?.doubleOptInEnabled ? "New contacts confirm first" : "Added straight away"} />
      </StatGroup>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel flush title="Details">
          <KeyValueList
            items={[
              {
                label: "Contact book ID",
                value: (
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-normal">
                    {contactBookId}
                    <CopyButton value={contactBookId} />
                  </span>
                ),
              },
              {
                label: "Variables",
                value:
                  (book?.variables ?? []).length > 0 ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {book!.variables.map((variable) => (
                        <code key={variable} className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-normal">
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground">None</span>
                  ),
              },
            ]}
          />
        </Panel>

        <Panel
          flush
          title="Recent broadcasts"
          actions={
            (book?.campaigns.length ?? 0) > 5 ? (
              <Link href="/broadcasts" className="text-xs text-muted-foreground hover:text-foreground">
                All
              </Link>
            ) : null
          }
        >
          {!contactBookDetailQuery.isLoading && book?.campaigns.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing has been sent to this list yet.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {book?.campaigns.slice(0, 5).map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    href={`/broadcasts/${campaign.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Megaphone className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{campaign.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(campaign.createdAt, { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel flush>
        <SettingRow
          title="Double opt-in"
          description={
            book?.doubleOptInEnabled
              ? "New contacts get a confirmation email and join the list once they click it."
              : "New contacts join the list straight away. Turn this on to confirm addresses first and keep the list clean."
          }
          control={
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={`/contacts/${contactBookId}/double-opt-in`}>{book?.doubleOptInEnabled ? "Edit email" : "Preview email"}</Link>
              </Button>
              <Switch
                checked={book?.doubleOptInEnabled ?? false}
                onCheckedChange={(checked) => updateContactBookMutation.mutate({ contactBookId, doubleOptInEnabled: checked })}
              />
            </div>
          }
        />
      </Panel>

      <ContactList
        contactBookId={contactBookId}
        contactBookName={book?.name}
        doubleOptInEnabled={book?.doubleOptInEnabled}
        contactBookVariables={book?.variables}
      />
    </div>
  );
}
