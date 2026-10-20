"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import TemplateList from "./template-list";
import CreateTemplate from "./create-template";

export default function TemplatesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Reusable emails you design once and send from the API or campaigns, with variables filled in per recipient."
        actions={<CreateTemplate />}
      />
      <TemplateList />
    </div>
  );
}
