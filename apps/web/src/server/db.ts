import { PrismaClient } from "@prisma/client";
import { env } from "~/env";
import { logger } from "./logger/log";

const createPrismaClient = () => {
  logger.info("Creating Prisma client");
  const client = new PrismaClient({
    log:
      env.NODE_ENV !== "development"
        ? ["error"]
        : env.PRISMA_LOG_QUERIES === "true"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
  });

  return client;
};

// eslint-disable-next-line no-undef
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = db;
