import { ApiPermission } from "@prisma/client";
import { db } from "../db";
import { randomBytes } from "crypto";
import { smallNanoid } from "../nanoid";
import { createSecureHash, verifySecureHash } from "../crypto";
import { logger } from "../logger/log";

export const TEST_KEY_PREFIX = "bs_test_";

export async function addApiKey({
  name,
  permission,
  teamId,
  domainId,
  isTest = false,
}: {
  name: string;
  permission: ApiPermission;
  teamId: number;
  domainId?: number;
  isTest?: boolean;
}) {
  try {
    if (domainId !== undefined) {
      const domain = await db.domain.findUnique({
        where: {
          id: domainId,
          teamId: teamId
        },
        select: { id: true },
      });

      if (!domain) {
        throw new Error("DOMAIN_NOT_FOUND");
      }
    }

    const clientId = smallNanoid(10);
    const token = randomBytes(16).toString("hex");
    const hashedToken = await createSecureHash(token);

    const prefix = isTest ? TEST_KEY_PREFIX : "bs_";
    const apiKey = `${prefix}${clientId}_${token}`;

    await db.apiKey.create({
      data: {
        name,
        permission: permission,
        teamId,
        domainId,
        tokenHash: hashedToken,
        partialToken: `${apiKey.slice(0, prefix.length + 3)}...${apiKey.slice(-3)}`,
        clientId,
        isTest,
      },
    });
    return apiKey;
  } catch (error) {
    logger.error({ err: error }, "Error adding API key");
    throw error;
  }
}

export async function getTeamAndApiKey(apiKey: string) {
  const isTestKey = apiKey.startsWith(TEST_KEY_PREFIX);
  const [clientId, token] = isTestKey ? apiKey.slice(TEST_KEY_PREFIX.length).split("_") : apiKey.split("_").slice(1);

  if (!clientId || !token) {
    return null;
  }

  const apiKeyRow = await db.apiKey.findUnique({
    where: {
      clientId,
    },
    include: {
      domain: {
        select: { id: true, name: true },
      },
    },
  });

  if (!apiKeyRow || apiKeyRow.isTest !== isTestKey) {
    return null;
  }

  try {
    const isValid = await verifySecureHash(token, apiKeyRow.tokenHash);
    if (!isValid) {
      return null;
    }

    const team = await db.team.findUnique({
      where: {
        id: apiKeyRow.teamId,
      },
    });

    return { team, apiKey: apiKeyRow };
  } catch (error) {
    logger.error({ err: error }, "Error verifying API key");
    return null;
  }
}

export async function updateApiKey({
  id,
  teamId,
  name,
  domainId,
}: {
  id: number;
  teamId: number;
  name?: string;
  domainId?: number | null;
}) {
  try {
    if (domainId !== undefined && domainId !== null) {
      const domain = await db.domain.findUnique({
        where: {
          id: domainId,
          teamId: teamId,
        },
        select: { id: true },
      });

      if (!domain) {
        throw new Error("DOMAIN_NOT_FOUND");
      }
    }

    return await db.apiKey.update({
      where: { id, teamId },
      data: {
        ...(name !== undefined && { name }),
        ...(domainId !== undefined && { domainId }),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error updating API key");
    throw error;
  }
}

export async function deleteApiKey(id: number) {
  try {
    await db.apiKey.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error deleting API key");
    throw error;
  }
}
