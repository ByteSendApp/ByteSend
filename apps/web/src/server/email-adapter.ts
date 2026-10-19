import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { db } from "~/server/db";

export function createEmailVerificationAdapter(): Adapter {
  const adapter = PrismaAdapter(db) as Adapter;

  return {
    ...adapter,
    useVerificationToken: adapter.useVerificationToken
      ?
      async (params) => {
        try {
          return await adapter.useVerificationToken!(params);
        } catch (error: any) {
          if (error?.code === "P2025") {
            console.warn(
              `[Auth] Verification token not found for ${params.identifier}. Token may have expired or been used already.`,
              error.meta
            );
            return null;
          }
          throw error;
        }
      }
      : undefined,
  };
}
