"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { Edit3, MoreVertical, Pause, Play, Webhook } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { toast } from "@bytesend/ui/src/toaster";
import { DeleteWebhook } from "./delete-webhook";
import { useState } from "react";
import { EditWebhookDialog } from "./webhook-update-dialog";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bytesend/ui/src/popover";
import { type Webhook as WebhookRow } from "@prisma/client";
import { WebhookStatusBadge } from "./webhook-status-badge";

export function WebhookList() {
  const webhooksQuery = api.webhook.list.useQuery();
  const testWebhook = api.webhook.test.useMutation();
  const setStatusMutation = api.webhook.setStatus.useMutation();
  const utils = api.useUtils();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  const webhooks = webhooksQuery.data ?? [];

  async function handleToggleStatus(webhookId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setStatusMutation.mutate(
      { id: webhookId, status: newStatus },
      {
        onSuccess: async () => {
          await utils.webhook.list.invalidate();
          toast.success(
            `Webhook ${newStatus === "ACTIVE" ? "resumed" : "paused"}`,
          );
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  if (webhooksQuery.isLoading) {
    return (
      <Panel flush>
        <ListSkeleton rows={3} />
      </Panel>
    );
  }

  if (webhooks.length === 0) {
    return (
      <Panel flush>
        <EmptyState
          icon={<Webhook />}
          title="No webhooks yet"
          description="Add an endpoint and ByteSend will POST to it whenever something happens to your email: delivered, bounced, complained, opened, clicked and more."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="https://docs.bytesend.cloud" target="_blank" rel="noopener noreferrer">
                Read the webhook docs
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
            <TableHead>Endpoint</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="hidden w-36 md:table-cell">Last delivered</TableHead>
            <TableHead className="hidden w-36 md:table-cell">Last failed</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {webhooks.map((webhook) => (
            <TableRow key={webhook.id} className="cursor-pointer" onClick={() => router.push(`/webhooks/${webhook.id}`)}>
              <TableCell className="max-w-0">
                <p className="truncate font-mono text-xs text-foreground">{webhook.url}</p>
              </TableCell>
              <TableCell>
                <WebhookStatusBadge status={webhook.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {webhook.lastSuccessAt ? formatDistanceToNow(webhook.lastSuccessAt, { addSuffix: true }) : "Never"}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {webhook.lastFailureAt ? (
                  <span className="text-destructive">{formatDistanceToNow(webhook.lastFailureAt, { addSuffix: true })}</span>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <WebhookActions
                    webhook={webhook}
                    onEdit={() => setEditingId(webhook.id)}
                    onToggleStatus={() => handleToggleStatus(webhook.id, webhook.status)}
                    isToggling={setStatusMutation.isPending}
                  />
                </div>
                {editingId === webhook.id ? (
                  <EditWebhookDialog
                    webhook={webhook}
                    open={editingId === webhook.id}
                    onOpenChange={(open) => setEditingId(open ? webhook.id : null)}
                  />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function WebhookActions({
  webhook,
  onEdit,
  onToggleStatus,
  isToggling,
}: {
  webhook: WebhookRow;
  onEdit: () => void;
  onToggleStatus: () => void;
  isToggling: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPaused = webhook.status === "PAUSED";
  const isAutoDisabled = webhook.status === "AUTO_DISABLED";
  const canActivate = isPaused || isAutoDisabled;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Webhook actions">
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start font-normal"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start font-normal"
            onClick={() => {
              onToggleStatus();
              setOpen(false);
            }}
            disabled={isToggling}
          >
            {canActivate ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                {isAutoDisabled ? "Re-enable" : "Resume"}
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            )}
          </Button>
          <DeleteWebhook webhook={webhook} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
