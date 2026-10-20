"use client";

import { Suspense } from "react";
import { PageHeader } from "@bytesend/ui/src/page-header";
import DomainsList from "./domain-list";
import AddDomain from "./add-domain";

export default function DomainsPage() {
  const addDomain = (
    <Suspense fallback={null}>
      <AddDomain />
    </Suspense>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Domains"
        description="The domains you send from, and the DNS records that prove you own them."
        actions={addDomain}
      />
      <DomainsList />
    </div>
  );
}
