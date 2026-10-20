import {
  NotificationProviderType,
  NotificationEventType,
  WebhookStatus,
  Prisma,
} from "@prisma/client";
import { createHmac, randomUUID } from "crypto";
import { db } from "../db";
import { logger } from "../logger/log";
import { ByteSendApiError } from "../public-api/api-error";
import { env } from "~/env";
import { getRedis, redisKey } from "../redis";

/**
 * Events that can fire once per email or contact. They're opt-in (a provider must select them
 * explicitly), rate-limited per provider, and never copied to the admin Discord, so a busy team
 * can't flood a channel, trip Discord/Slack rate limits or bury platform alerts.
 */
export const HIGH_VOLUME_EVENTS = new Set<NotificationEventType>([
  "EMAIL_SENT",
  "EMAIL_DELIVERED",
  "EMAIL_BOUNCED",
  "EMAIL_COMPLAINED",
  "EMAIL_OPENED",
  "EMAIL_CLICKED",
  "CONTACT_CREATED",
  "CONTACT_DELETED",
]);
export const HIGH_VOLUME_PER_PROVIDER_PER_MINUTE = 20;
const OPT_IN_CACHE_SECONDS = 60;

/** A provider with no events selected receives everything except the high-volume ones. */
export function providerReceives(eventTypes: NotificationEventType[], eventType: NotificationEventType) {
  if (eventTypes.includes(eventType)) return true;
  return eventTypes.length === 0 && !HIGH_VOLUME_EVENTS.has(eventType);
}

const optInCacheKey = (teamId: number) => redisKey(`notif:optin:${teamId}`);

export type DiscordConfig = {
  webhookUrl: string;
  mentionRole?: string;
  threadId?: string;
};

export type SlackConfig = {
  webhookUrl: string;
  channelId?: string;
  botToken?: string;
};

export type MicrosoftTeamsConfig = {
  webhookUrl: string;
  adaptiveCard?: boolean;
};

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

export type CustomWebhookConfig = {
  url: string;
  headers?: Record<string, string>;
  secret?: string;
};

export type NotificationProviderConfig =
  | DiscordConfig
  | SlackConfig
  | MicrosoftTeamsConfig
  | TelegramConfig
  | CustomWebhookConfig;

export interface NotificationMessage {
  title: string;
  description?: string;
  color?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: boolean;
  data?: Record<string, unknown>;
}

export class NotificationProviderService {
  public static async createProvider(params: {
    teamId: number;
    type: NotificationProviderType;
    name: string;
    description?: string;
    config: NotificationProviderConfig;
    eventTypes?: NotificationEventType[];
  }) {
    this.validateConfig(params.type, params.config);

    const provider = await db.notificationProvider.create({
      data: {
        teamId: params.teamId,
        type: params.type,
        name: params.name,
        description: params.description,
        config: params.config,
        eventTypes: params.eventTypes || [],
        isActive: true,
      },
    });
    await this.clearOptInCache(params.teamId);

    logger.info(
      { providerId: provider.id, type: params.type },
      "Notification provider created"
    );

    return provider;
  }

  public static async updateProvider(params: {
    id: string;
    teamId: number;
    name?: string;
    description?: string;
    config?: Partial<NotificationProviderConfig>;
    eventTypes?: NotificationEventType[];
    isActive?: boolean;
  }) {
    const provider = await db.notificationProvider.findUnique({
      where: { id: params.id },
    });

    if (!provider) {
      throw new ByteSendApiError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    if (provider.teamId !== params.teamId) {
      throw new ByteSendApiError({ code: "UNAUTHORIZED", message: "Provider not found" });
    }

    const updatedConfig = params.config
      ? { ...(provider.config as Record<string, unknown>), ...params.config }
      : undefined;

    if (updatedConfig) {
      this.validateConfig(provider.type, updatedConfig as NotificationProviderConfig);
    }

    const updated = await db.notificationProvider.update({
      where: { id: params.id },
      data: {
        name: params.name,
        description: params.description,
        config: updatedConfig,
        eventTypes: params.eventTypes,
        isActive: params.isActive,
        updatedAt: new Date(),
      },
    });
    await this.clearOptInCache(updated.teamId);

    logger.info({ providerId: params.id }, "Notification provider updated");

    return updated;
  }

  public static async listProviders(teamId: number) {
    return db.notificationProvider.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });
  }

  public static async getProvider(id: string, teamId: number) {
    const provider = await db.notificationProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new ByteSendApiError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    if (provider.teamId !== teamId) {
      throw new ByteSendApiError({ code: "UNAUTHORIZED", message: "Provider not found" });
    }

    return provider;
  }

  public static async deleteProvider(id: string, teamId: number) {
    const provider = await db.notificationProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new ByteSendApiError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    if (provider.teamId !== teamId) {
      throw new ByteSendApiError({ code: "UNAUTHORIZED", message: "Provider not found" });
    }

    await db.notificationProvider.delete({
      where: { id },
    });
    await this.clearOptInCache(teamId);

    logger.info({ providerId: id }, "Notification provider deleted");
  }

  public static async sendNotification(
    teamId: number,
    providerId: string,
    message: NotificationMessage,
    eventType: NotificationEventType
  ) {
    const provider = await db.notificationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider || provider.teamId !== teamId || !provider.isActive) {
      throw new ByteSendApiError({ code: "NOT_FOUND", message: "Provider not found or inactive" });
    }

    if (!providerReceives(provider.eventTypes, eventType)) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Provider does not handle this event type" });
    }

    const notificationLog = await db.notificationLog.create({
      data: {
        teamId,
        providerId,
        eventType,
        payload: message as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    try {
      await this.dispatchNotification(provider, message);

      await db.notificationLog.update({
        where: { id: notificationLog.id },
        data: {
          status: "SENT",
          lastError: null,
          updatedAt: new Date(),
        },
      });

      await db.notificationProvider.update({
        where: { id: providerId },
        data: {
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
        },
      });

      logger.info(
        { providerId, eventType },
        "Notification sent successfully"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await db.notificationLog.update({
        where: { id: notificationLog.id },
        data: {
          status: "FAILED",
          lastError: errorMessage,
          updatedAt: new Date(),
        },
      });

      await db.notificationProvider.update({
        where: { id: providerId },
        data: {
          lastFailureAt: new Date(),
          consecutiveFailures: {
            increment: 1,
          },
        },
      });

      logger.error(
        { providerId, error: errorMessage },
        "Failed to send notification"
      );

      throw error;
    }
  }

  public static async testProvider(id: string, teamId: number) {
    const provider = await this.getProvider(id, teamId);

    const testMessage: NotificationMessage = {
      title: "ByteSend Notification Test",
      description: "This is a test message to verify your notification provider is working correctly.",
      color: "#0EA5E9",
      fields: [
        {
          name: "Provider Type",
          value: provider.type,
          inline: true,
        },
        {
          name: "Team ID",
          value: teamId.toString(),
          inline: true,
        },
      ],
      timestamp: true,
    };

    await this.dispatchNotification(provider, testMessage);

    await db.notificationProvider.update({
      where: { id },
      data: {
        testMessageSentAt: new Date(),
      },
    });

    logger.info({ providerId: id }, "Test notification sent");
  }

  /** Whether any of the team's active providers selected this event; cached briefly per team. */
  private static async teamOptedInTo(teamId: number, eventType: NotificationEventType) {
    const redis = getRedis();
    const key = optInCacheKey(teamId);
    try {
      const cached = await redis.get(key);
      if (cached !== null) return (JSON.parse(cached) as string[]).includes(eventType);
    } catch {
      // Fall through to the database when Redis is unavailable.
    }
    const providers = await db.notificationProvider.findMany({
      where: { teamId, isActive: true },
      select: { eventTypes: true },
    });
    const optedIn = [...new Set(providers.flatMap((p) => p.eventTypes))];
    await redis.set(key, JSON.stringify(optedIn), "EX", OPT_IN_CACHE_SECONDS).catch(() => void 0);
    return optedIn.includes(eventType);
  }

  private static async withinRateLimit(providerId: string) {
    try {
      const key = redisKey(`notif:rate:${providerId}:${Math.floor(Date.now() / 60_000)}`);
      const redis = getRedis();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 120);
      return count <= HIGH_VOLUME_PER_PROVIDER_PER_MINUTE;
    } catch {
      return true;
    }
  }

  private static async clearOptInCache(teamId: number) {
    await getRedis().del(optInCacheKey(teamId)).catch(() => void 0);
  }

  public static async broadcastNotification(
    teamId: number,
    eventType: NotificationEventType,
    message: NotificationMessage
  ) {
    const highVolume = HIGH_VOLUME_EVENTS.has(eventType);
    // Most teams never opt in to per-email events, so skip the provider query for them.
    if (highVolume && !(await this.teamOptedInTo(teamId, eventType))) {
      return { sent: 0, failed: 0 };
    }

    const providers = await db.notificationProvider.findMany({
      where: {
        teamId,
        isActive: true,
        OR: highVolume
          ? [{ eventTypes: { has: eventType } }]
          : [{ eventTypes: { isEmpty: true } }, { eventTypes: { has: eventType } }],
      },
    });

    let sent = 0;
    let failed = 0;

    for (const provider of providers) {
      if (highVolume && !(await this.withinRateLimit(provider.id))) {
        continue;
      }
      try {
        await this.sendNotification(teamId, provider.id, message, eventType);
        sent++;
      } catch (error) {
        failed++;
      }
    }

    const adminUrl = env.ADMIN_DISCORD_WEBHOOK_URL;
    if (adminUrl && !highVolume) {
      const alreadyCovered = providers.some((p) => {
        const cfg = p.config as Record<string, unknown>;
        return cfg?.webhookUrl === adminUrl || cfg?.url === adminUrl;
      });

      if (!alreadyCovered) {
        try {
          await this.sendToDiscord({ webhookUrl: adminUrl }, {
            ...message,
            fields: [
              ...(message.fields ?? []),
              { name: "Team ID", value: String(teamId), inline: true },
            ],
          });
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : error },
            "Failed to send notification to admin webhook"
          );
        }
      }
    }

    logger.info(
      { teamId, eventType, sent, failed },
      "Broadcast notifications completed"
    );

    return { sent, failed };
  }

  private static async dispatchNotification(
    provider: any,
    message: NotificationMessage
  ) {
    switch (provider.type) {
      case "DISCORD":
        return this.sendToDiscord(provider.config, message);
      case "SLACK":
        return this.sendToSlack(provider.config, message);
      case "MICROSOFT_TEAMS":
        return this.sendToMicrosoftTeams(provider.config, message);
      case "TELEGRAM":
        return this.sendToTelegram(provider.config, message);
      case "CUSTOM_WEBHOOK":
        return this.sendToCustomWebhook(provider.config, message);
      default:
        throw new Error(`Unknown provider type: ${provider.type}`);
    }
  }

  private static async sendToDiscord(
    config: DiscordConfig,
    message: NotificationMessage
  ) {
    const embed = {
      title: message.title,
      description: message.description,
      color: message.color ? parseInt(message.color.replace("#", ""), 16) : 3669732, // Blue
      fields: message.fields,
      timestamp: message.timestamp ? new Date().toISOString() : undefined,
      footer: {
        text: "ByteSend",
        icon_url: "https://bytesend.cloud/favicon.ico",
      },
    };

    const payload = {
      embeds: [embed],
      ...(config.mentionRole && { content: `<@&${config.mentionRole}>` }),
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Discord API returned ${response.status}: ${response.statusText}`
      );
    }
  }

  private static async sendToSlack(
    config: SlackConfig,
    message: NotificationMessage
  ) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: message.title,
        },
      },
      ...(message.description
        ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message.description,
            },
          },
        ]
        : []),
      ...(message.fields && message.fields.length > 0
        ? [
          {
            type: "section",
            fields: message.fields.map((field) => ({
              type: "mrkdwn",
              text: `*${field.name}*\n${field.value}`,
            })),
          },
        ]
        : []),
    ];

    const payload = {
      blocks,
      ...(message.data && {
        attachments: [
          {
            fallback: message.title,
            color: message.color || "#0EA5E9",
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Slack API returned ${response.status}: ${response.statusText}`
      );
    }
  }

  private static async sendToMicrosoftTeams(
    config: MicrosoftTeamsConfig,
    message: NotificationMessage
  ) {
    const themeColor = message.color || "0EA5E9";

    const payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: message.title,
      themeColor: themeColor.replace("#", ""),
      sections: [
        {
          activityTitle: message.title,
          activitySubtitle: message.description,
          facts: message.fields?.map((field) => ({
            name: field.name,
            value: field.value,
          })),
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Microsoft Teams API returned ${response.status}: ${response.statusText}`
      );
    }
  }

  private static async sendToTelegram(
    config: TelegramConfig,
    message: NotificationMessage
  ) {
    let text = `*${message.title}*\n`;

    if (message.description) {
      text += `${message.description}\n\n`;
    }

    if (message.fields && message.fields.length > 0) {
      text += message.fields.map((f) => `*${f.name}:* ${f.value}`).join("\n");
    }

    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Telegram API returned ${response.status}: ${response.statusText}`
      );
    }
  }

  private static async sendToCustomWebhook(
    config: CustomWebhookConfig,
    message: NotificationMessage
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.secret) {
      const payload = JSON.stringify(message);
      const signature = createHmac("sha256", config.secret)
        .update(payload)
        .digest("hex");
      headers["X-ByteSend-Signature"] = `v1=${signature}`;
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(
        `Custom webhook returned ${response.status}: ${response.statusText}`
      );
    }
  }

  private static assertNotAdminWebhook(webhookUrl: string) {
    const adminUrl = env.ADMIN_DISCORD_WEBHOOK_URL;
    if (adminUrl && webhookUrl === adminUrl) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "This webhook URL is reserved and cannot be used as a team notification provider." });
    }
  }

  private static validateConfig(
    type: NotificationProviderType,
    config: NotificationProviderConfig
  ) {
    switch (type) {
      case "DISCORD":
        if (!("webhookUrl" in config) || !config.webhookUrl) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Discord webhook URL is required" });
        }
        this.assertNotAdminWebhook(config.webhookUrl);
        this.assertAllowedWebhookUrl(config.webhookUrl, "Discord", [
          "discord.com",
          "discordapp.com",
        ]);
        break;

      case "SLACK":
        if (!("webhookUrl" in config) || !config.webhookUrl) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Slack webhook URL is required" });
        }
        this.assertNotAdminWebhook(config.webhookUrl);
        this.assertAllowedWebhookUrl(config.webhookUrl, "Slack", [
          "hooks.slack.com",
        ]);
        break;

      case "MICROSOFT_TEAMS":
        if (!("webhookUrl" in config) || !config.webhookUrl) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Microsoft Teams webhook URL is required" });
        }
        this.assertAllowedWebhookUrl(config.webhookUrl, "Microsoft Teams", [
          "outlook.webhook.office.com",
          "webhook.office.com",
          "outlook.office.com",
        ]);
        break;

      case "TELEGRAM":
        if (!("botToken" in config) || !config.botToken) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Telegram bot token is required" });
        }
        if (!("chatId" in config) || !config.chatId) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Telegram chat ID is required" });
        }
        break;

      case "CUSTOM_WEBHOOK":
        if (!("url" in config) || !config.url) {
          throw new ByteSendApiError({ code: "BAD_REQUEST", message: "Webhook URL is required" });
        }
        break;
    }
  }

  private static assertAllowedWebhookUrl(
    rawUrl: string,
    providerName: string,
    allowedHostnames: string[]
  ) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: `${providerName} webhook URL is invalid` });
    }

    if (parsedUrl.protocol !== "https:") {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: `${providerName} webhook URL must use HTTPS` });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = allowedHostnames.some((allowedHostname) => {
      const normalizedAllowed = allowedHostname.toLowerCase();
      return (
        hostname === normalizedAllowed ||
        hostname.endsWith(`.${normalizedAllowed}`)
      );
    });

    if (!isAllowed) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: `Invalid ${providerName} webhook URL` });
    }
  }
}
