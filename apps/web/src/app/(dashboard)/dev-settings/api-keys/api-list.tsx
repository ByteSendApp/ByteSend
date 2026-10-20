"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Edit3, KeyRound } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { api } from "~/trpc/react";
import DeleteApiKey from "./delete-api-key";
import { EditApiKeyDialog } from "./edit-api-key";

export default function ApiList() {
  const apiKeysQuery = api.apiKey.getApiKeys.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const keys = apiKeysQuery.data ?? [];

  if (apiKeysQuery.isLoading) {
    return (
      <Panel flush>
        <ListSkeleton rows={3} />
      </Panel>
    );
  }

  if (keys.length === 0) {
    return (
      <Panel flush>
        <EmptyState
          icon={<KeyRound />}
          title="No API keys yet"
          description="Create a key to send email from your app with the REST API or one of the SDKs. Keys can be limited to one domain."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer">
                API reference
              </a>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Key</TableHead>
            <TableHead className="hidden w-28 md:table-cell">Access</TableHead>
            <TableHead className="hidden lg:table-cell">Domains</TableHead>
            <TableHead className="w-32">Last used</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              <TableCell className="max-w-0">
                <p className="truncate font-medium text-foreground">{apiKey.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Created {formatDistanceToNow(apiKey.createdAt, { addSuffix: true })}
                </p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <code className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {apiKey.partialToken}
                </code>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant={apiKey.permission === "FULL" ? "info" : "neutral"} className="capitalize">
                  {apiKey.permission.toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {apiKey.domainId ? (apiKey.domain?.name ?? "Domain removed") : "All domains"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {apiKey.lastUsed ? formatDistanceToNow(apiKey.lastUsed, { addSuffix: true }) : <span className="text-warning">Never used</span>}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={`Edit ${apiKey.name}`}
                    onClick={() => setEditingId(apiKey.id)}
                  >
                    <Edit3 className="size-3.5" />
                  </Button>
                  <DeleteApiKey apiKey={apiKey} />
                  <EditApiKeyDialog apiKey={apiKey} open={editingId === apiKey.id} onOpenChange={(open) => !open && setEditingId(null)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
