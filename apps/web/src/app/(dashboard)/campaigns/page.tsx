"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import CampaignList from "./campaign-list";
import CreateCampaign from "./create-campaign";

export default function CampaignsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        description="Emails you design in the editor and send or schedule to one or more contact books, with delivery and engagement tracked."
        actions={<CreateCampaign intent="CAMPAIGN" basePath="/campaigns" />}
      />
      <CampaignList intent="CAMPAIGN" basePath="/campaigns" />
    </div>
  );
}
