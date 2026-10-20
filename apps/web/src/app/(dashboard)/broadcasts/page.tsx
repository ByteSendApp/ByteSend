"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import CampaignList from "../campaigns/campaign-list";
import CreateBroadcast from "./create-broadcast";

export default function BroadcastsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Broadcasts"
        description="One-off emails to a contact book, like newsletters and announcements. Send straight away or schedule for later."
        actions={<CreateBroadcast />}
      />
      <CampaignList intent="BROADCAST" basePath="/broadcasts" />
    </div>
  );
}
