import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { db } from "~/server/db";
import { attachmentsOf } from "~/server/service/inbound-service";

const route = createRoute({
  method: "get",
  path: "/v1/inbound/emails",
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
      limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 50 }),
      recipient: z.string().optional().openapi({ description: "Only mail sent to this address", example: "support@reply.acme.com" }),
      since: z.string().datetime().optional().openapi({ description: "Only mail received after this time (ISO 8601)" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                recipient: z.string(),
                from: z.string(),
                fromName: z.string().nullable(),
                subject: z.string(),
                attachmentCount: z.number(),
                inReplyToEmailId: z.string().nullable(),
                receivedAt: z.string(),
              }),
            ),
            hasMore: z.boolean(),
          }),
        },
      },
      description: "Received emails, newest first",
    },
  },
});

function listInbound(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const { page = 1, limit = 50, recipient, since } = c.req.valid("query");

    const emails = await db.inboundEmail.findMany({
      where: {
        teamId: team.id,
        ...(team.apiKey.domainId ? { domainId: team.apiKey.domainId } : {}),
        ...(recipient ? { recipient: recipient.toLowerCase() } : {}),
        ...(since ? { receivedAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
      select: { id: true, recipient: true, from: true, fromName: true, subject: true, attachments: true, inReplyToEmailId: true, receivedAt: true },
    });

    return c.json({
      data: emails.slice(0, limit).map(({ attachments, receivedAt, ...email }) => ({
        ...email,
        attachmentCount: attachmentsOf({ attachments }).length,
        receivedAt: receivedAt.toISOString(),
      })),
      hasMore: emails.length > limit,
    });
  });
}

export default listInbound;
