"use client";

import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { KeyValueList, Panel } from "@bytesend/ui/src/panel";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

export default function InboundSetup() {
  const setup = api.admin.getInboundSetup.useQuery();
  const ensure = api.admin.setupInbound.useMutation({
    onSuccess: (result) => toast.success(`Receiving rule "${result.rule}" is active in ${result.region}`),
    onError: (error) => toast.error(error.message),
  });
  const data = setup.data;
  if (!data) return null;
  const configured = Boolean(data.bucket && data.topicArn);

  return (
    <Panel
      flush
      title="Receiving (inbound email)"
      description="SES stores received mail in the bucket and notifies the topic, which should be subscribed to /api/inbound_callback."
      actions={
        <Button size="sm" variant="outline" onClick={() => ensure.mutate()} isLoading={ensure.isPending} disabled={!configured}>
          Create receiving rule
        </Button>
      }
    >
      {!configured ? (
        <div className="p-4">
          <Callout tone="warning" title="Not configured">
            Set <code className="font-mono">INBOUND_S3_BUCKET</code> and <code className="font-mono">INBOUND_SNS_TOPIC_ARN</code>, then create the receiving rule.
            The bucket needs a policy that lets SES write to it.
          </Callout>
        </div>
      ) : null}
      <KeyValueList
        items={[
          { label: "Status", value: <Badge variant={configured ? "success" : "neutral"} dot>{configured ? "Configured" : "Off"}</Badge> },
          { label: "Region", value: <span className="font-mono text-xs font-normal">{data.region}</span> },
          { label: "Bucket", value: <span className="font-mono text-xs font-normal">{data.bucket ?? "–"}</span> },
          { label: "Topic", value: <span className="font-mono text-xs font-normal">{data.topicArn ?? "–"}</span> },
          { label: "Hosted domain", value: data.hostedDomain ? <span className="font-mono text-xs font-normal">{data.hostedDomain} → MX {data.mxHost}</span> : "–" },
        ]}
      />
    </Panel>
  );
}
