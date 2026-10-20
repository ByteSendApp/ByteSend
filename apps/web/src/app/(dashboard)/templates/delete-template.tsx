"use client";

import { Button } from "@bytesend/ui/src/button";
import { DeleteResource } from "~/components/DeleteResource";
import { api } from "~/trpc/react";
import { Template } from "@prisma/client";
import { toast } from "@bytesend/ui/src/toaster";
import { Trash2 } from "lucide-react";
import { z } from "zod";

export const DeleteTemplate: React.FC<{
  template: Partial<Template> & { id: string };
}> = ({ template }) => {
  const deleteTemplateMutation = api.template.deleteTemplate.useMutation();
  const utils = api.useUtils();

  const templateSchema = z
    .object({
      confirmation: z
        .string()
        .min(1, "Please type the template name to confirm"),
    })
    .refine((data) => data.confirmation === template.name, {
      message: "Template name does not match",
      path: ["confirmation"],
    });

  async function onTemplateDelete(values: z.infer<typeof templateSchema>) {
    deleteTemplateMutation.mutate(
      {
        templateId: template.id,
      },
      {
        onSuccess: () => {
          utils.template.getTemplates.invalidate();
          toast.success(`Template deleted`);
        },
      },
    );
  }

  return (
    <DeleteResource
      title="Delete Template"
      resourceName={template.name || ""}
      schema={templateSchema}
      isLoading={deleteTemplateMutation.isPending}
      onConfirm={onTemplateDelete}
      trigger={
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label="Delete template">
          <Trash2 className="size-3.5" />
        </Button>
      }
      confirmLabel="Delete Template"
    />
  );
};

export default DeleteTemplate;
