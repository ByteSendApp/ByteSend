import { Prisma, SuppressionReason, SuppressionList } from "@prisma/client";
import { db } from "../db";
import { ByteSendApiError } from "~/server/public-api/api-error";
import { logger } from "../logger/log";
import { deleteFromSesSuppressionList } from "../aws/ses";

export type AddSuppressionParams = {
  email: string;
  teamId: number;
  reason: SuppressionReason;
  source?: string;
};

export type GetSuppressionListParams = {
  teamId: number;
  page?: number;
  limit?: number;
  search?: string;
  reason?: SuppressionReason | null;
  sortBy?: "email" | "reason" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type SuppressionListResult = {
  suppressions: SuppressionList[];
  total: number;
};

export class SuppressionService {
  static async addSuppression(
    params: AddSuppressionParams
  ): Promise<SuppressionList> {
    const { email, teamId, reason, source } = params;

    try {
      const suppression = await db.suppressionList.upsert({
        where: {
          teamId_email: {
            teamId,
            email: email.toLowerCase().trim(),
          },
        },
        create: {
          email: email.toLowerCase().trim(),
          teamId,
          reason,
          source,
        },
        update: {
          reason,
          source,
          updatedAt: new Date(),
        },
      });

      logger.info(
        {
          email,
          teamId,
          reason,
          source,
          suppressionId: suppression.id,
        },
        "Email added to suppression list"
      );

      return suppression;
    } catch (error) {
      logger.error(
        {
          email,
          teamId,
          reason,
          source,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to add email to suppression list"
      );

      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add email to suppression list",
      });
    }
  }

  static async isEmailSuppressed(
    email: string,
    teamId: number
  ): Promise<boolean> {
    try {
      const suppression = await db.suppressionList.findUnique({
        where: {
          teamId_email: {
            teamId,
            email: email.toLowerCase().trim(),
          },
        },
      });

      return !!suppression;
    } catch (error) {
      logger.error(
        {
          email,
          teamId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to check email suppression status"
      );

      return false;
    }
  }

  static async removeSuppression(email: string, teamId: number): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const teamDomains = await db.domain.findMany({
        where: { teamId },
        select: { region: true },
      });
      const uniqueRegions = [...new Set(teamDomains.map((d) => d.region))];

      if (uniqueRegions.length > 0) {
        const results = await Promise.allSettled(
          uniqueRegions.map((region) =>
            deleteFromSesSuppressionList(normalizedEmail, region)
          )
        );

        const failures = results.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" && r.value === false)
        );
        if (failures.length > 0) {
          logger.warn(
            {
              email: normalizedEmail,
              teamId,
              failedRegions: failures.length,
              totalRegions: uniqueRegions.length,
            },
            "Some AWS SES regions failed during suppression removal"
          );
        }
      }
    } catch (error) {
      logger.error(
        {
          email: normalizedEmail,
          teamId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to cleanup AWS SES suppression (continuing with local deletion)"
      );
    }

    try {
      const deleted = await db.suppressionList.deleteMany({
        where: {
          teamId,
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
      });

      if (deleted.count === 0) {
        logger.debug(
          {
            email: normalizedEmail,
            teamId,
          },
          "Attempted to remove non-existent suppression - already not suppressed"
        );
        return;
      }

      logger.info(
        {
          email: normalizedEmail,
          teamId,
          deletedCount: deleted.count,
        },
        "Email removed from suppression list"
      );
    } catch (error) {
      logger.error(
        {
          email: normalizedEmail,
          teamId,
          error:
            error instanceof Prisma.PrismaClientKnownRequestError
              ? `${error.code}: ${error.message}`
              : error instanceof Error
                ? error.message
                : "Unknown error",
        },
        "Failed to remove email from suppression list"
      );

      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to remove email from suppression list",
      });
    }
  }

  static async getSuppressionList(
    params: GetSuppressionListParams
  ): Promise<SuppressionListResult> {
    const {
      teamId,
      page = 1,
      limit = 20,
      search,
      reason,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const offset = (page - 1) * limit;

    const where = {
      teamId,
      ...(search && {
        email: {
          contains: search,
          mode: "insensitive" as const,
        },
      }),
      ...(reason && { reason }),
    };

    try {
      const [suppressions, total] = await Promise.all([
        db.suppressionList.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        db.suppressionList.count({ where }),
      ]);

      return {
        suppressions,
        total,
      };
    } catch (error) {
      logger.error(
        {
          teamId,
          page,
          limit,
          search,
          reason,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get suppression list"
      );

      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get suppression list",
      });
    }
  }

  static async addMultipleSuppressions(
    teamId: number,
    emails: string[],
    reason: SuppressionReason
  ) {
    const normalizedEmails = emails.map((email) => email.toLowerCase().trim());
    const uniqueEmails = Array.from(new Set(normalizedEmails));

    try {
      const batchSize = 1000;
      for (let i = 0; i < uniqueEmails.length; i += batchSize) {
        const batch = uniqueEmails.slice(i, i + batchSize);

        const alreadySuppressed = await db.suppressionList.findMany({
          where: {
            teamId,
            email: { in: batch },
          },
        });

        const emailsToAdd = batch.filter(
          (email) => !alreadySuppressed.some((s) => s.email === email)
        );

        await db.suppressionList.createMany({
          data: emailsToAdd.map((email) => ({
            teamId,
            email,
            reason,
          })),
        });
      }

      logger.info(
        {
          originalCount: emails.length,
          uniqueCount: uniqueEmails.length,
        },
        "Added multiple emails to suppression list"
      );
    } catch (error) {
      logger.error(
        {
          originalCount: emails.length,
          uniqueCount: uniqueEmails.length,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to add multiple emails to suppression list"
      );

      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add multiple emails to suppression list",
      });
    }
  }

  static async getSuppressionStats(
    teamId: number
  ): Promise<Record<SuppressionReason, number>> {
    try {
      const stats = await db.suppressionList.groupBy({
        by: ["reason"],
        where: { teamId },
        _count: { _all: true },
      });

      const result: Record<SuppressionReason, number> = {
        HARD_BOUNCE: 0,
        COMPLAINT: 0,
        MANUAL: 0,
      };

      stats.forEach((stat) => {
        result[stat.reason] = stat._count._all;
      });

      return result;
    } catch (error) {
      logger.error(
        {
          teamId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get suppression stats"
      );

      throw new ByteSendApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get suppression stats",
      });
    }
  }

  static async checkMultipleEmails(
    emails: string[],
    teamId: number
  ): Promise<Record<string, boolean>> {
    try {
      const normalizedEmails = emails.map((email) =>
        email.toLowerCase().trim()
      );

      const suppressions = await db.suppressionList.findMany({
        where: {
          teamId,
          email: {
            in: normalizedEmails,
          },
        },
        select: {
          email: true,
        },
      });

      const suppressedEmails = new Set(suppressions.map((s) => s.email));

      const result: Record<string, boolean> = {};
      emails.forEach((email) => {
        result[email] = suppressedEmails.has(email.toLowerCase().trim());
      });

      return result;
    } catch (error) {
      logger.error(
        {
          emailCount: emails.length,
          teamId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to check multiple emails for suppression"
      );

      const result: Record<string, boolean> = {};
      emails.forEach((email) => {
        result[email] = false;
      });

      return result;
    }
  }
}
