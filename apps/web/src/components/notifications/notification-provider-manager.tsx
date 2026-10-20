import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import { Input } from "@bytesend/ui/src/input";
import { Label } from "@bytesend/ui/src/label";
import { Textarea } from "@bytesend/ui/src/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import { Badge } from "@bytesend/ui/src/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bytesend/ui/src/card";
import { AlertCircle, CheckCircle, Trash2, Edit2, Send, Eye, EyeOff } from "lucide-react";
import { ProviderConfigForm, ProviderTypeBadge } from "./provider-config-form";
import { toast } from "@bytesend/ui/src/toaster";

const PROVIDER_TYPES = [
  { value: "DISCORD", label: "Discord" },
  { value: "SLACK", label: "Slack" },
  { value: "MICROSOFT_TEAMS", label: "Microsoft Teams" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "CUSTOM_WEBHOOK", label: "Custom Webhook" },
];

const EVENT_TYPES = [
  { value: "EMAIL_SENT", label: "Email Sent" },
  { value: "EMAIL_DELIVERED", label: "Email Delivered" },
  { value: "EMAIL_BOUNCED", label: "Email Bounced" },
  { value: "EMAIL_COMPLAINED", label: "Email Complained" },
  { value: "EMAIL_OPENED", label: "Email Opened" },
  { value: "EMAIL_CLICKED", label: "Email Clicked" },
  { value: "CONTACT_CREATED", label: "Contact Created" },
  { value: "CONTACT_DELETED", label: "Contact Deleted" },
  { value: "DOMAIN_VERIFIED", label: "Domain Verified" },
  { value: "DOMAIN_HEALTH", label: "Domain DNS Problems" },
  { value: "USAGE_ALERT", label: "Usage Alerts" },
  { value: "CAMPAIGN_STARTED", label: "Campaign Started" },
  { value: "CAMPAIGN_COMPLETED", label: "Campaign Completed" },
  { value: "ERROR_ALERT", label: "Error Alert" },
];

export function NotificationProviderManager() {
  const utils = api.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "DISCORD",
    name: "",
    description: "",
    config: {},
    eventTypes: [] as string[],
  });

  const { data: providers, isLoading } = api.notificationProvider.list.useQuery();
  const { mutate: createProvider, isPending: isCreating } = api.notificationProvider.create.useMutation({
    onSuccess: () => {
      toast.success("Provider created successfully");
      resetForm();
      setIsOpen(false);
      utils.notificationProvider.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create provider");
    },
  });

  const { mutate: updateProvider, isPending: isUpdating } = api.notificationProvider.update.useMutation({
    onSuccess: () => {
      toast.success("Provider updated successfully");
      resetForm();
      setIsOpen(false);
      utils.notificationProvider.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update provider");
    },
  });

  const { mutate: deleteProvider, isPending: isDeleting } = api.notificationProvider.delete.useMutation({
    onSuccess: () => {
      toast.success("Provider deleted successfully");
      utils.notificationProvider.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete provider");
    },
  });

  const { mutate: testProvider, isPending: isTesting } = api.notificationProvider.test.useMutation({
    onSuccess: () => {
      toast.success("Test message sent successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send test message");
    },
  });

  const resetForm = () => {
    setFormData({
      type: "DISCORD",
      name: "",
      description: "",
      config: {},
      eventTypes: [],
    });
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Provider name is required");
      return;
    }

    if (editingId) {
      updateProvider({
        id: editingId,
        name: formData.name,
        description: formData.description,
        config: formData.config,
        eventTypes: formData.eventTypes.length > 0 ? (formData.eventTypes as any) : undefined,
      });
    } else {
      createProvider({
        type: formData.type as any,
        name: formData.name,
        description: formData.description,
        config: formData.config,
        eventTypes: formData.eventTypes.length > 0 ? (formData.eventTypes as any) : undefined,
      });
    }
  };

  const handleEdit = (provider: any) => {
    setFormData({
      type: provider.type,
      name: provider.name,
      description: provider.description || "",
      config: provider.config || {},
      eventTypes: provider.eventTypes || [],
    });
    setEditingId(provider.id);
    setIsOpen(true);
  };

  const toggleEventType = (eventType: string) => {
    setFormData((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter((t) => t !== eventType)
        : [...prev.eventTypes, eventType],
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading providers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Notification Providers</h2>
          <p className="text-muted-foreground mt-1">
            Manage notification channels for your team events
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
        >
          + Add Provider
        </Button>
      </div>

      {/* Providers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers?.map((provider) => (
          <Card key={provider.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{provider.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {provider.description || "No description"}
                  </CardDescription>
                </div>
                <ProviderTypeBadge type={provider.type} />
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {provider.isActive ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Active</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-600">Inactive</span>
                    </>
                  )}
                </div>

                {/* Event Types */}
                {provider.eventTypes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Events:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {provider.eventTypes.map((event) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {EVENT_TYPES.find((e) => e.value === event)?.label || event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failure Status */}
                {provider.consecutiveFailures > 0 && (
                  <div className="text-xs text-red-600">
                    ⚠️ {provider.consecutiveFailures} consecutive failures
                  </div>
                )}

                {/* Last Activity */}
                {provider.lastSuccessAt && (
                  <div className="text-xs text-muted-foreground">
                    Last success: {new Date(provider.lastSuccessAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testProvider({ id: provider.id })}
                  disabled={isTesting}
                  className="flex-1"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(provider)}
                  className="flex-1"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteProvider({ id: provider.id })}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {providers?.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground">
            No notification providers yet. Create one to get started.
          </p>
        </Card>
      )}

      {/* Add/Edit Provider Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex w-[calc(100vw-1rem)] max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6">
            <DialogTitle>
              {editingId ? "Edit Provider" : "Add Notification Provider"}
            </DialogTitle>
            <DialogDescription>
              Configure a notification provider to receive event alerts
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {/* Provider Type */}
            {!editingId && (
              <div>
                <Label htmlFor="provider-type">Provider Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value,
                      config: {}, // Reset config when changing type
                    }))
                  }
                >
                  <SelectTrigger id="provider-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Provider Name */}
            <div>
              <Label htmlFor="provider-name">Provider Name *</Label>
              <Input
                id="provider-name"
                placeholder="e.g., Team Alerts, Critical Errors"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="provider-description">Description</Label>
              <Textarea
                id="provider-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="h-20"
              />
            </div>

            {/* Provider Config */}
            <ProviderConfigForm
              type={formData.type}
              config={formData.config}
              onChange={(config) =>
                setFormData((prev) => ({ ...prev, config }))
              }
            />

            {/* Event Types Filter */}
            <div>
              <Label className="mb-2 block">Events to Monitor (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty for domain, campaign, usage and error alerts. Per-email and contact events can be busy, so
                they&apos;re only sent if you tick them, and are capped at 20 per minute per provider.
              </p>
              <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {EVENT_TYPES.map((event) => (
                  <label
                    key={event.value}
                    className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={formData.eventTypes.includes(event.value)}
                      onChange={() => toggleEventType(event.value)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs sm:text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || isUpdating}
            >
              {editingId ? "Update Provider" : "Create Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
