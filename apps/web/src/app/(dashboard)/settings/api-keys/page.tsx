"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import AddApiKey from "../../dev-settings/api-keys/add-api-key";
import ApiList from "../../dev-settings/api-keys/api-list";

export default function SettingsApiKeysPage() {
  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys your app uses to send through the API and SDKs. Treat them like passwords: they're only shown once."
        actions={<AddApiKey />}
      />
      <ApiList />
    </>
  );
}
