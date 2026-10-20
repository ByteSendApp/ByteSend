"use client";

import { use, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import Spinner from "@bytesend/ui/src/spinner";
import { Callout } from "@bytesend/ui/src/callout";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { useBreadcrumb } from "~/components/dashboard/breadcrumbs";
import { WebhookStatusBadge } from "../webhook-status-badge";
import { Button } from "@bytesend/ui/src/button";
import {
  Edit3,
  Key,
  MoreVertical,
  Pause,
  Play,
  TestTube,
  Webhook as WebhookIcon,
} from "lucide-react";
import { toast } from "@bytesend/ui/src/toaster";
import { WebhookInfo } from "./webhook-info";
import { WebhookCallsTable } from "./webhook-calls-table";
import { WebhookCallDetails } from "./webhook-call-details";
import { DeleteWebhook } from "../delete-webhook";
import { EditWebhookDialog } from "../webhook-update-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bytesend/ui/src/popover";
import { type Webhook } from "@prisma/client";

function WebhookDetailActions({
  webhook,
  onTest,
  onEdit,
  onToggleStatus,
  onRotateSecret,
  isTestPending,
  isToggling,
  isRotating,
}: {
  webhook: Webhook;
  onTest: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onRotateSecret: () => void;
  isTestPending: boolean;
  isToggling: boolean;
  isRotating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPaused = webhook.status === "PAUSED";
  const isAutoDisabled = webhook.status === "AUTO_DISABLED";
  const canActivate = isPaused || isAutoDisabled;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          More
          <MoreVertical className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start font-normal"
            onClick={() => {
              onTest();
              setOpen(false);
            }}
            disabled={isTestPending}
          >
            <TestTube className="mr-2 h-4 w-4" />
            Test webhook
          </Button>
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start font-normal"
            onClick={() => {
              onRotateSecret();
              setOpen(false);
            }}
            disabled={isRotating}
          >
            <Key className="mr-2 h-4 w-4" />
            Rotate secret
          </Button>
          <DeleteWebhook webhook={webhook} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function WebhookDetailPage({
  params,
}: {
  params: Promise<{ webhookId: string }>;
}) {
  const { webhookId } = use(params);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const webhookQuery = api.webhook.getById.useQuery({ id: webhookId });
  const testWebhook = api.webhook.test.useMutation();
  const setStatusMutation = api.webhook.setStatus.useMutation();
  const updateWebhook = api.webhook.update.useMutation();
  const callsQuery = api.webhook.listCalls.useQuery({
    webhookId,
    limit: 50,
  });
  const utils = api.useUtils();

  const webhook = webhookQuery.data;

  useEffect(() => {
    if (!selectedCallId && callsQuery.data?.items.length) {
      setSelectedCallId(callsQuery.data.items[0]!.id);
    }
  }, [callsQuery.data, selectedCallId]);

  const handleTest = () => {
    testWebhook.mutate(
      { id: webhookId },
      {
        onSuccess: async () => {
          await utils.webhook.listCalls.invalidate();
          toast.success("Test webhook enqueued");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleToggleStatus = (currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setStatusMutation.mutate(
      { id: webhookId, status: newStatus },
      {
        onSuccess: async () => {
          await utils.webhook.getById.invalidate();
          toast.success(
            `Webhook ${newStatus === "ACTIVE" ? "resumed" : "paused"}`,
          );
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleRotateSecret = () => {
    updateWebhook.mutate(
      { id: webhookId, rotateSecret: true },
      {
        onSuccess: async () => {
          await utils.webhook.getById.invalidate();
          toast.success("Secret rotated successfully");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  useBreadcrumb(`/webhooks/${webhookId}`, webhook ? webhook.url.replace(/^https?:\/\//, "") : undefined);

  if (webhookQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!webhook) {
    return <EmptyState icon={<WebhookIcon />} title="Webhook not found" description="It may have been deleted, or it belongs to another team." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<span className="font-mono text-base sm:text-lg">{webhook.url.replace(/^https?:\/\//, "")}</span>}
        meta={<WebhookStatusBadge status={webhook.status} />}
        description={`Created ${formatDistanceToNow(webhook.createdAt, { addSuffix: true })}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testWebhook.isPending}>
              <TestTube className="size-3.5" />
              Send test
            </Button>
            <WebhookDetailActions
              webhook={webhook}
              onTest={handleTest}
              onEdit={() => setIsEditDialogOpen(true)}
              onToggleStatus={() => handleToggleStatus(webhook.status)}
              onRotateSecret={handleRotateSecret}
              isTestPending={testWebhook.isPending}
              isToggling={setStatusMutation.isPending}
              isRotating={updateWebhook.isPending}
            />
          </>
        }
      />

      {webhook.status === "AUTO_DISABLED" ? (
        <Callout tone="danger" title="This webhook was turned off after repeated failures">
          Check the endpoint is reachable and answers with a 2xx status, then use <strong>More → Re-enable</strong>.
        </Callout>
      ) : null}

      <WebhookInfo webhook={webhook} />

      <div className="grid gap-4 lg:h-[calc(100vh-320px)] lg:min-h-[560px] lg:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <WebhookCallsTable webhookId={webhookId} selectedCallId={selectedCallId} onSelectCall={setSelectedCallId} />
        </div>
        <div className="min-h-0 overflow-auto">
          {selectedCallId ? (
            <WebhookCallDetails callId={selectedCallId} />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-border text-[13px] text-muted-foreground">
              Pick a delivery to see the request and response
            </div>
          )}
        </div>
      </div>

      {isEditDialogOpen && <EditWebhookDialog webhook={webhook} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />}
    </div>
  );
}
