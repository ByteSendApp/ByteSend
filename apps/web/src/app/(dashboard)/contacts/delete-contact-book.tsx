"use client";

import { Button } from "@bytesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { ContactBook } from "@prisma/client";
import { toast } from "@bytesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import type { ReactNode } from "react";

export const DeleteContactBook: React.FC<{
  contactBook: Partial<ContactBook> & { id: string };
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
}> = ({ contactBook, trigger, open, onOpenChange, onSuccess }) => {
  const deleteContactBookMutation =
    api.contacts.deleteContactBook.useMutation();
  const utils = api.useUtils();

  const contactBookSchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Please type the contact book name to confirm"),
    })
    .refine((data) => data.confirmation === contactBook.name, {
      message: "Contact book name does not match",
      path: ["confirmation"],
    });

  async function onContactBookDelete(
    values: z.infer<typeof contactBookSchema>,
  ) {
    deleteContactBookMutation.mutate(
      {
        contactBookId: contactBook.id,
      },
      {
        onSuccess: async () => {
          utils.contacts.getContactBooks.invalidate();
          await onSuccess?.();
          toast.success(`Contact book deleted`);
        },
      },
    );
  }

  const dialogTrigger =
    trigger ??
    (open === undefined ? (
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
        <Trash2 className="size-3.5" />
      </Button>
    ) : null);

  return (
    <DeleteResource
      title="Delete Contact Book"
      resourceName={contactBook.name || ""}
      schema={contactBookSchema}
      isLoading={deleteContactBookMutation.isPending}
      onConfirm={onContactBookDelete}
      open={open}
      onOpenChange={onOpenChange}
      trigger={dialogTrigger}
      confirmLabel="Delete Contact Book"
    />
  );
};

export default DeleteContactBook;
