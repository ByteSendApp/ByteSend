"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import { AddWebhook } from "./add-webhook";
import { WebhookList } from "./webhook-list";

export default function WebhooksPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Webhooks"
        description="Get an HTTP request when an email is delivered, bounces, is opened and more, so your app can react in real time."
        actions={<AddWebhook />}
      />
      <WebhookList />
    </div>
  );
}
