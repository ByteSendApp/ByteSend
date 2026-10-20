import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Context, Next } from "hono";
import { handleError } from "./api-error";
import { env } from "~/env";
import { getRedis, redisKey } from "~/server/redis";
import { getTeamFromToken } from "~/server/public-api/auth";
import { isSelfHosted } from "~/utils/common";
import { ByteSendApiError } from "./api-error";
import { Team, ApiKey } from "@prisma/client";
import { logger } from "../logger/log";

export type AppEnv = {
  Variables: {
    team: Team & { apiKeyId: number; apiKey: { domainId: number | null; isTest: boolean } };
  };
};

export function getApp() {
  const app = new OpenAPIHono<AppEnv>().basePath("/api");

  app.onError(handleError);

  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    if (
      c.req.path.startsWith("/api/v1/doc") ||
      c.req.path.startsWith("/api/v1/ui") ||
      c.req.path === "/api/health" ||
      c.req.path === "/api/v1/smtp/auth"
    ) {
      return next();
    }

    try {
      const team = await getTeamFromToken(c as any);
      c.set("team", team);
    } catch (error) {
      if (error instanceof ByteSendApiError) {
        throw error;
      }
      logger.error({ err: error }, "Error in getTeamFromToken middleware");
      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Authentication failed",
      });
    }
    await next();
  });

  const RATE_LIMIT_WINDOW_SECONDS = 1;

  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    if (
      isSelfHosted() ||
      !c.var.team ||
      c.req.path.startsWith("/api/v1/doc") ||
      c.req.path.startsWith("/api/v1/ui") ||
      c.req.path === "/api/health" ||
      c.req.path === "/api/v1/smtp/auth"
    ) {
      return next();
    }

    const team = c.var.team;
    const limit = team.apiRateLimit ?? 2;
    const key = redisKey(`rl:${team.id}`);
    const redis = getRedis();

    let currentRequests: number;
    let ttl: number;

    try {
      currentRequests = await redis.incr(key);

      if (currentRequests === 1) {
        await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }
      ttl = await redis.ttl(key);
    } catch (error) {
      logger.error({ err: error }, "Redis error during rate limiting");
      return next();
    }

    const resetTime =
      Math.floor(Date.now() / 1000) +
      (ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS);
    const remainingRequests = Math.max(0, limit - currentRequests);

    c.res.headers.set("X-RateLimit-Limit", String(limit));
    c.res.headers.set("X-RateLimit-Remaining", String(remainingRequests));
    c.res.headers.set("X-RateLimit-Reset", String(resetTime));

    if (currentRequests > limit) {
      c.res.headers.set(
        "Retry-After",
        String(ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS)
      );
      throw new ByteSendApiError({
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Try again in ${ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS} seconds.`,
      });
    }

    await next();
  });

  app.doc("/v1/doc", (c) => ({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "ByteSend API",
    },
    servers: [{ url: `${env.NEXTAUTH_URL}/api` }],
  }));

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
  });

  app.get("/v1/ui", swaggerUI({ url: "/api/v1/doc" }));

  return app;
}

export type PublicAPIApp = OpenAPIHono<AppEnv>;
