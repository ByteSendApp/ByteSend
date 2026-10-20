import { createRoute, z } from "@hono/zod-openapi";
import { PublicAPIApp } from "~/server/public-api/hono";
import { db } from "~/server/db";
import { toReceivedPayload } from "~/server/service/inbound-service";
import { ByteSendApiError } from "../../api-error";

const route = createRoute({
  method: "get",
  path: "/v1/inbound/emails/{id}",
  request: {
    params: z.object({
      id: z.string().min(3).openapi({ param: { name: "id", in: "path" }, example: "inb_4f1c2a9e8d7b6a5c4f3e2d1c" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            recipient: z.string(),
            from: z.string(),
            fromName: z.string().nullable().optional(),
            to: z.array(z.string()),
            cc: z.array(z.string()),
            replyTo: z.array(z.string()),
            subject: z.string(),
            text: z.string().nullable().optional(),
            html: z.string().nullable().optional(),
            messageId: z.string().nullable().optional(),
            inReplyTo: z.string().nullable().optional(),
            inReplyToEmailId: z.string().nullable().optional(),
            attachments: z.array(
              z.object({
                id: z.string(),
                filename: z.string(),
                contentType: z.string(),
                size: z.number(),
                url: z.string().optional().openapi({ description: "Signed download link, valid for one hour" }),
              }),
            ),
            authentication: z.object({
              spf: z.string().nullable().optional(),
              dkim: z.string().nullable().optional(),
              dmarc: z.string().nullable().optional(),
              spam: z.string().nullable().optional(),
              virus: z.string().nullable().optional(),
            }),
            domainId: z.number().nullable().optional(),
            receivedAt: z.string(),
          }),
        },
      },
      description: "A received email, with signed links to its attachments",
    },
  },
});

function getInbound(app: PublicAPIApp) {
  app.openapi(route, async (c) => {
    const team = c.var.team;
    const email = await db.inboundEmail.findFirst({
      where: { id: c.req.param("id"), teamId: team.id, ...(team.apiKey.domainId ? { domainId: team.apiKey.domainId } : {}) },
    });
    if (!email) throw new ByteSendApiError({ code: "NOT_FOUND", message: "Received email not found" });
    return c.json(toReceivedPayload(email));
  });
}

export default getInbound;
