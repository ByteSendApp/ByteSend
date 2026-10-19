import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";
import { env } from "~/env";
import { cookies } from "next/headers";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { getChildLogger, logger, withLogger } from "../logger/log";
import { randomUUID } from "crypto";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerAuthSession();

  let twoFactorVerified = false;
  if (session?.user?.id) {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get("bytesend_2fa")?.value;
    if (cookieVal) {
      const { validateTwoFactorCookie } = await import("~/app/api/auth/2fa/route");
      twoFactorVerified = validateTwoFactorCookie(cookieVal, session.user.id);
    }
    if (!twoFactorVerified) {
      const userRecord = await db.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorEnabled: true },
      });
      if (!userRecord?.twoFactorEnabled) twoFactorVerified = true;
    }
  }

  return {
    db,
    session,
    twoFactorVerified,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await db.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isBanned: true },
  });

  if (user?.isBanned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has been suspended. Please contact support via Discord.",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = authedProcedure.use(({ ctx, next }) => {
  return next();
});

export const twoFactorProtectedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.twoFactorVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Two-factor authentication required. Please verify your identity.",
    });
  }
  return next();
});

export const teamProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const requestedTeamId = ctx.headers.get("x-team-id");
  const numericTeamId = requestedTeamId ? parseInt(requestedTeamId, 10) : NaN;

  const teamUser = await db.teamUser.findFirst({
    where: {
      userId: ctx.session.user.id,
      ...(!isNaN(numericTeamId) ? { teamId: numericTeamId } : {}),
    },
    include: { team: true },
  });

  if (!teamUser) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
  }

  return withLogger(
    getChildLogger({
      teamId: teamUser.team.id,
      requestId: randomUUID(),
    }),
    async () => {
      return next({
        ctx: {
          team: teamUser.team,
          teamUser,
          session: { ...ctx.session, user: ctx.session.user },
        },
      });
    }
  );
});

export const teamAdminProcedure = teamProcedure.use(async ({ ctx, next }) => {
  if (ctx.teamUser.role !== "ADMIN") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not authorized to perform this action",
    });
  }

  return next();
});

export const domainProcedure = teamProcedure
  .input(z.object({ id: z.number() }))
  .use(async ({ ctx, next, input }) => {
    const domain = await db.domain.findUnique({
      where: { id: input.id, teamId: ctx.team.id },
    });
    if (!domain) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
    }

    return next({ ctx: { ...ctx, domain } });
  });

export const emailProcedure = teamProcedure
  .input(z.object({ id: z.string() }))
  .use(async ({ ctx, next, input }) => {
    const email = await db.email.findUnique({
      where: { id: input.id, teamId: ctx.team.id },
    });
    if (!email) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
    }

    return next({ ctx: { ...ctx, email } });
  });

export const apiKeyProcedure = teamProcedure
  .input(z.object({ id: z.number() }))
  .use(async ({ ctx, next, input }) => {
    const apiKey = await db.apiKey.findUnique({
      where: { id: input.id, teamId: ctx.team.id },
    });
    if (!apiKey) {
      throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
    }

    return next({ ctx: { ...ctx, apiKey } });
  });

export const contactBookProcedure = teamProcedure
  .input(
    z.object({
      contactBookId: z.string(),
    })
  )
  .use(async ({ ctx, next, input }) => {
    const contactBook = await db.contactBook.findUnique({
      where: { id: input.contactBookId, teamId: ctx.team.id },
    });
    if (!contactBook) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Contact book not found",
      });
    }

    return next({ ctx: { ...ctx, contactBook } });
  });

export const campaignProcedure = teamProcedure
  .input(
    z.object({
      campaignId: z.string(),
    })
  )
  .use(async ({ ctx, next, input }) => {
    const campaign = await db.campaign.findUnique({
      where: { id: input.campaignId, teamId: ctx.team.id },
    });
    if (!campaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    return next({ ctx: { ...ctx, campaign } });
  });

export const templateProcedure = teamProcedure
  .input(
    z.object({
      templateId: z.string(),
    })
  )
  .use(async ({ ctx, next, input }) => {
    const template = await db.template.findUnique({
      where: { id: input.templateId, teamId: ctx.team.id },
    });
    if (!template) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Template not found",
      });
    }

    return next({ ctx: { ...ctx, template } });
  });

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (env.NEXT_PUBLIC_IS_CLOUD && !ctx.session.user.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});

export const founderProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session.user.isFounder) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});
