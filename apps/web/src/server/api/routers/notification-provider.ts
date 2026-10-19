import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { NotificationProviderType, NotificationEventType } from "@prisma/client";
import { NotificationProviderService } from "~/server/service/notification-provider-service";

const PROVIDER_TYPES_ENUM = z.enum(Object.values(NotificationProviderType) as [string, ...string[]]);
const EVENT_TYPES_ENUM = z.enum(Object.values(NotificationEventType) as [string, ...string[]]);

const discordConfigSchema = z.object({
  webhookUrl: z.string().url(),
  mentionRole: z.string().optional(),
  threadId: z.string().optional(),
});

const slackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channelId: z.string().optional(),
  botToken: z.string().optional(),
});

const teamsConfigSchema = z.object({
  webhookUrl: z.string().url(),
  adaptiveCard: z.boolean().optional(),
});

const telegramConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

const customWebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  secret: z.string().optional(),
});

const configSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DISCORD"), config: discordConfigSchema }),
  z.object({ type: z.literal("SLACK"), config: slackConfigSchema }),
  z.object({ type: z.literal("MICROSOFT_TEAMS"), config: teamsConfigSchema }),
  z.object({ type: z.literal("TELEGRAM"), config: telegramConfigSchema }),
  z.object({ type: z.literal("CUSTOM_WEBHOOK"), config: customWebhookConfigSchema }),
]).transform((data) => ({ type: data.type, ...data.config }));

export const notificationProviderRouter = createTRPCRouter({
  list: teamProcedure.query(async ({ ctx }) => {
    return NotificationProviderService.listProviders(ctx.team.id);
  }),

  getById: teamProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return NotificationProviderService.getProvider(input.id, ctx.team.id);
    }),

  create: teamProcedure
    .input(
      z.object({
        type: PROVIDER_TYPES_ENUM,
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        config: z.union([
          discordConfigSchema,
          slackConfigSchema,
          teamsConfigSchema,
          telegramConfigSchema,
          customWebhookConfigSchema,
        ]),
        eventTypes: z.array(EVENT_TYPES_ENUM).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return NotificationProviderService.createProvider({
        teamId: ctx.team.id,
        type: input.type as NotificationProviderType,
        name: input.name,
        description: input.description,
        config: input.config as any,
        eventTypes: input.eventTypes as NotificationEventType[],
      });
    }),

  update: teamProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(500).nullable().optional(),
        config: z.union([
          discordConfigSchema,
          slackConfigSchema,
          teamsConfigSchema,
          telegramConfigSchema,
          customWebhookConfigSchema,
        ]).optional(),
        eventTypes: z.array(EVENT_TYPES_ENUM).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return NotificationProviderService.updateProvider({
        id: input.id,
        teamId: ctx.team.id,
        name: input.name,
        description: input.description || undefined,
        config: input.config as any,
        eventTypes: input.eventTypes as NotificationEventType[],
        isActive: input.isActive,
      });
    }),

  delete: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await NotificationProviderService.deleteProvider(input.id, ctx.team.id);
      return { success: true };
    }),

  test: teamProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await NotificationProviderService.testProvider(input.id, ctx.team.id);
      return { success: true };
    }),

  getLogs: teamProcedure
    .input(
      z.object({
        providerId: z.string(),
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
        status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await NotificationProviderService.getProvider(input.providerId, ctx.team.id);

      return await ctx.db.notificationLog.findMany({
        where: {
          teamId: ctx.team.id,
          providerId: input.providerId,
          ...(input.status && { status: input.status }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });
    }),

  getStats: teamProcedure.query(async ({ ctx }) => {
    const providers = await ctx.db.notificationProvider.findMany({
      where: { teamId: ctx.team.id },
      select: {
        id: true,
        type: true,
        name: true,
        isActive: true,
        consecutiveFailures: true,
        lastSuccessAt: true,
        lastFailureAt: true,
      },
    });

    const stats = await ctx.db.notificationLog.groupBy({
      by: ["status"],
      where: { teamId: ctx.team.id },
      _count: true,
    });

    return {
      totalProviders: providers.length,
      activeProviders: providers.filter((p) => p.isActive).length,
      providersByType: providers.reduce(
        (acc, p) => {
          acc[p.type] = (acc[p.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      logStats: {
        sent: stats.find((s) => s.status === "SENT")?._count || 0,
        failed: stats.find((s) => s.status === "FAILED")?._count || 0,
        pending: stats.find((s) => s.status === "PENDING")?._count || 0,
      },
      failingProviders: providers.filter((p) => p.consecutiveFailures > 0),
    };
  }),
});
