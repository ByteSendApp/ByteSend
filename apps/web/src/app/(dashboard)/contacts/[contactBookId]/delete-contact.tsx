"use client";

import { Button } from "@bytesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { Contact } from "@prisma/client";
import { toast } from "@bytesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";

export const DeleteContact: React.FC<{
  contact: Partial<Contact> & { id: string; contactBookId: string };
}> = ({ contact }) => {
  const deleteContactMutation = api.contacts.deleteContact.useMutation();
  const utils = api.useUtils();

  const contactSchema = z
    .object({
      confirmation: z.string().email("Please enter a valid email address"),
    })
    .refine((data) => data.confirmation === contact.email, {
      message: "Email does not match",
      path: ["confirmation"],
    });

  async function onContactDelete(values: z.infer<typeof contactSchema>) {
    deleteContactMutation.mutate(
      {
        contactId: contact.id,
        contactBookId: contact.contactBookId,
      },
      {
        onSuccess: () => {
          utils.contacts.contacts.invalidate();
          toast.success(`Contact deleted`);
        },
        onError: (e) => {
          toast.error(`Contact not deleted: ${e.message}`);
        },
      },
    );
  }

  return (
    <DeleteResource
      title="Delete Contact"
      resourceName={contact.email || ""}
      schema={contactSchema}
      isLoading={deleteContactMutation.isPending}
      onConfirm={onContactDelete}
      trigger={
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      }
      confirmLabel="Delete Contact"
    />
  );
};

export default DeleteContact;
