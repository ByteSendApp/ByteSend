import { Context } from "hono";
import { db } from "../db";
import { ByteSendApiError } from "./api-error";
import { getTeamAndApiKey } from "../service/api-service";
import { isSelfHosted } from "~/utils/common";
import { logger } from "../logger/log";

export const getTeamFromToken = async (c: Context) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new ByteSendApiError({
      code: "UNAUTHORIZED",
      message: "No Authorization header provided",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new ByteSendApiError({
      code: "UNAUTHORIZED",
      message: "No Authorization header provided",
    });
  }

  const teamAndApiKey = await getTeamAndApiKey(token);

  if (!teamAndApiKey) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: "Invalid API token",
    });
  }

  const { team, apiKey } = teamAndApiKey;

  if (!team) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: "Invalid API token",
    });
  }

  if (team.isBlocked) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: "This team has been blocked. Please contact support via Discord: https://discord.com/invite/BU8n8pJv8S",
    });
  }

  const bannedAdmin = await db.teamUser.findFirst({
    where: {
      teamId: team.id,
      role: "ADMIN",
      user: { isBanned: true },
    },
    select: { userId: true },
  });

  if (bannedAdmin) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: "Account suspended. Please contact support via Discord: https://discord.com/invite/BU8n8pJv8S",
    });
  }

  db.apiKey
    .update({
      where: {
        id: apiKey.id,
      },
      data: {
        lastUsed: new Date(),
      },
    })
    .catch((err) =>
      logger.error({ err }, "Failed to update lastUsed on API key")
    );

  return { ...team, apiKeyId: apiKey.id, apiKey: { domainId: apiKey.domainId } };
};
