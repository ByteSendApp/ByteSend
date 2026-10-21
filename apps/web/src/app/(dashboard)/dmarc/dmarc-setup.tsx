"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { CopyField } from "@bytesend/ui/src/copy-field";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Panel } from "@bytesend/ui/src/panel";
import type { AppRouter } from "~/server/api/root";

type Setup = inferRouterOutputs<AppRouter>["dmarc"]["setup"];

export function DmarcSetup({ setup, isLoading }: { setup?: Setup; isLoading: boolean }) {
  if (isLoading || !setup) return <ListSkeleton rows={4} />;

  if (setup.domains.length === 0) {
    return (
      <Panel flush>
        <EmptyState
          icon={<Globe />}
          title="No verified domains yet"
          description="Reports are about domains you send from. Add and verify a domain first."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/domains">Add a domain</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Callout title="How it works">
        Add your report address to the <code className="font-mono">rua</code> tag of each domain&apos;s DMARC record. Google, Microsoft, Yahoo and
        others then send a daily summary of every message they saw using your domain. We keep your existing policy and only add the address.
      </Callout>

      {setup.domains.map((domain) => (
        <Panel
          key={domain.orgDomain}
          title={domain.orgDomain}
          description={domain.sendingDomains.some((name) => name !== domain.orgDomain) ? `Covers ${domain.sendingDomains.join(", ")}` : undefined}
          actions={
            domain.reportsToUs ? (
              <Badge variant="success" dot>
                Reporting to ByteSend
              </Badge>
            ) : domain.record ? (
              <Badge variant="warning" dot>
                Address not added
              </Badge>
            ) : (
              <Badge variant="neutral" dot>
                No DMARC record
              </Badge>
            )
          }
        >
          <div className="space-y-3 text-[13px]">
            {domain.record ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current record</p>
                <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">{domain.record}</p>
              </div>
            ) : null}
            {!domain.reportsToUs && domain.suggested ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{domain.record ? "Replace it with" : "Add this TXT record"}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <CopyField value={`_dmarc.${domain.orgDomain}`} display="_dmarc" />
                  <CopyField value={domain.suggested} />
                </div>
              </div>
            ) : null}
            {!domain.address ? (
              <p className="text-muted-foreground">
                Set up receiving on a subdomain of {domain.orgDomain} in the <Link href="/inbox?tab=addresses" className="text-foreground underline">Inbox</Link> to get a report
                address.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Reports go to <span className="font-mono text-foreground">{domain.address}</span>. They don&apos;t count toward your receiving allowance.
              </p>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}
