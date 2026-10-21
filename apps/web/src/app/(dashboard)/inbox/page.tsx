"use client";

import { Inbox } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel } from "@bytesend/ui/src/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import { useUrlState } from "~/hooks/useUrlState";
import { api } from "~/trpc/react";
import { InboxList } from "./inbox-list";
import { ReceivingAddresses } from "./receiving-addresses";
import { ForwardingRules } from "./forwarding-rules";

export default function InboxPage() {
  const [tab, setTab] = useUrlState("tab", "received");
  const overview = api.inbound.overview.useQuery();
  const usage = overview.data?.usage;

  if (overview.data && !overview.data.enabled) {
    return (
      <div className="space-y-5">
        <PageHeader title="Inbox" description="Receive email on your own domains and handle it with webhooks, the API or forwarding." />
        <Panel flush>
          <EmptyState
            icon={<Inbox />}
            title="Receiving isn't switched on here"
            description="This ByteSend instance hasn't been set up to receive email yet. An admin needs to set INBOUND_S3_BUCKET and INBOUND_SNS_TOPIC_ARN; see the self-hosting docs."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description={`Mail received on your addresses. Kept for ${overview.data?.retentionDays ?? 30} days, then deleted automatically.`}
        meta={
          usage ? (
            <Badge variant={usage.used >= usage.allowance ? "danger" : "neutral"}>
              {usage.used.toLocaleString()} of {usage.allowance.toLocaleString()} this month
            </Badge>
          ) : null
        }
      />
      <Tabs value={tab ?? "received"} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="forwarding">Forwarding</TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="mt-4">
          <InboxList hostedAddress={overview.data?.hostedAddress ?? null} onSetUp={() => setTab("addresses")} />
        </TabsContent>
        <TabsContent value="addresses" className="mt-4">
          <ReceivingAddresses hostedAddress={overview.data?.hostedAddress ?? null} region={overview.data?.region} />
        </TabsContent>
        <TabsContent value="forwarding" className="mt-4">
          <ForwardingRules />
        </TabsContent>
      </Tabs>
    </div>
  );
}
