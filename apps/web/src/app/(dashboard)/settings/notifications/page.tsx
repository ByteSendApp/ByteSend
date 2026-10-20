"use client";

import React from "react";
import { NotificationProviderManager } from "~/components/notifications/notification-provider-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bytesend/ui/src/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import { Badge } from "@bytesend/ui/src/badge";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";
import { api } from "~/trpc/react";

export default function NotificationSettingsPage() {
  const { data: stats } = api.notificationProvider.getStats.useQuery();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Send alerts about your team's email to Discord, Slack, Microsoft Teams, Telegram or any webhook: domain problems, usage alerts, campaigns and, if you choose, every send."
      />

      {stats ? (
        <StatGroup>
          <Stat label="Active channels" value={stats.activeProviders} hint={`of ${stats.totalProviders} set up`} />
          <Stat label="Alerts sent" value={stats.logStats.sent.toLocaleString()} hint="Recently" />
          <Stat
            label="Failed"
            value={stats.logStats.failed.toLocaleString()}
            tone={stats.logStats.failed > 0 ? "danger" : "default"}
            hint={`${stats.failingProviders?.length || 0} channel(s) failing`}
          />
          <Stat
            label="By type"
            value={Object.keys(stats.providersByType || {}).length}
            hint={Object.entries(stats.providersByType || {}).map(([type, count]) => `${type.toLowerCase()} ${count}`).join(", ") || "None yet"}
          />
        </StatGroup>
      ) : null}

      {/* Main Content */}
      <Tabs defaultValue="providers" className="w-full">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="help">Help & Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <NotificationProviderManager />
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Setting Up Each Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Discord */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge>Discord</Badge>
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-4 list-decimal">
                  <li>Go to your Discord server and open Server Settings</li>
                  <li>Navigate to Integrations → Webhooks</li>
                  <li>Click "New Webhook" and select a channel</li>
                  <li>Copy the Webhook URL and paste it in the configuration</li>
                  <li>Optionally add a role ID to mention on alerts</li>
                </ol>
              </div>

              {/* Slack */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge>Slack</Badge>
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-4 list-decimal">
                  <li>Go to your Slack workspace and create a new app</li>
                  <li>Enable Incoming Webhooks in the app features</li>
                  <li>Create a new webhook for your desired channel</li>
                  <li>Copy the Webhook URL and use it in the configuration</li>
                  <li>For better functionality, also provide a Bot Token</li>
                </ol>
              </div>

              {/* Microsoft Teams */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge>Microsoft Teams</Badge>
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-4 list-decimal">
                  <li>Open the Teams channel where you want notifications</li>
                  <li>Click the three dots (...) next to the channel name</li>
                  <li>Select "Connectors" and search for "Incoming Webhook"</li>
                  <li>Configure the webhook and copy the URL</li>
                  <li>Paste the URL in the configuration</li>
                </ol>
              </div>

              {/* Telegram */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge>Telegram</Badge>
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-4 list-decimal">
                  <li>Create a new bot by messaging @BotFather on Telegram</li>
                  <li>Copy the bot token provided</li>
                  <li>Get your chat ID using @userinfobot or a Telegram API client</li>
                  <li>Enter both values in the configuration</li>
                  <li>Make sure to message the bot first to establish a conversation</li>
                </ol>
              </div>

              {/* Custom Webhook */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge>Custom Webhook</Badge>
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  For any custom integration or third-party service:
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground ml-4 list-decimal">
                  <li>Provide your webhook URL that accepts POST requests</li>
                  <li>Optionally set custom headers for authentication</li>
                  <li>Optionally provide a secret to sign requests with HMAC-SHA256</li>
                  <li>The webhook will receive JSON notification data</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Notification Format */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Format</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Each notification will include the following information:
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "title": "Event notification title",
  "description": "Detailed description of the event",
  "color": "#0EA5E9",
  "fields": [
    {
      "name": "Field Name",
      "value": "Field Value",
      "inline": true
    }
  ],
  "timestamp": true,
  "data": { ... additional event data ... }
}`}
              </pre>
            </CardContent>
          </Card>

          {/* Event Types Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Available Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                You can filter notifications by event type:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "EMAIL_SENT",
                  "EMAIL_DELIVERED",
                  "EMAIL_BOUNCED",
                  "EMAIL_COMPLAINED",
                  "EMAIL_OPENED",
                  "EMAIL_CLICKED",
                  "CONTACT_CREATED",
                  "CONTACT_DELETED",
                  "DOMAIN_VERIFIED",
                  "CAMPAIGN_STARTED",
                  "CAMPAIGN_COMPLETED",
                  "ERROR_ALERT",
                ].map((event) => (
                  <Badge key={event} variant="secondary">
                    {event}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
