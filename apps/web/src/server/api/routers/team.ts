import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  teamProcedure,
  teamAdminProcedure,
} from "~/server/api/trpc";
import { TeamService } from "~/server/service/team-service";
import { getPresignedUploadUrl, isStorageConfigured } from "~/server/storage/s3";

export const teamRouter = createTRPCRouter({
  createTeam: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeam(ctx.session.user.id, input.name);
    }),

  getTeams: protectedProcedure.query(async ({ ctx }) => {
    return TeamService.getUserTeams(ctx.session.user.id);
  }),

  getTeamUsers: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamUsers(ctx.team.id);
  }),

  getTeamDetails: teamProcedure.query(async ({ ctx }) => {
    return ctx.db.team.findUniqueOrThrow({
      where: { id: ctx.team.id },
      select: { id: true, name: true, smtpUsername: true },
    });
  }),

  getTeamInvites: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamInvites(ctx.team.id);
  }),

  createTeamInvite: teamAdminProcedure
    .input(
      z.object({
        email: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeamInvite(
        ctx.team.id,
        input.email,
        input.role,
        ctx.team.name,
        input.sendEmail,
      );
    }),

  updateTeamUserRole: teamAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.updateTeamUserRole(
        ctx.team.id,
        input.userId,
        input.role,
      );
    }),

  deleteTeamUser: teamProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamUser(
        ctx.team.id,
        input.userId,
        ctx.teamUser.role,
        ctx.session.user.id,
      );
    }),

  resendTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.resendTeamInvite(
        ctx.team.id,
        input.inviteId,
        ctx.team.name,
      );
    }),

  deleteTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamInvite(ctx.team.id, input.inviteId);
    }),

  updateTeam: teamAdminProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        image: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.updateTeam(ctx.team.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
      });
    }),

  updateSmtpUsername: teamAdminProcedure
    .input(
      z.object({
        smtpUsername: z
          .string()
          .min(1)
          .max(64)
          .regex(
            /^[a-zA-Z0-9_.-]+$/,
            "Only letters, numbers, underscores, dots and hyphens are allowed",
          )
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.team.update({
        where: { id: ctx.team.id },
        data: { smtpUsername: input.smtpUsername },
        select: { id: true, smtpUsername: true },
      });
    }),

  deleteTeam: teamAdminProcedure.mutation(async ({ ctx }) => {
    const adminCount = await ctx.db.teamUser.count({
      where: { teamId: ctx.team.id, role: "ADMIN" },
    });
    if (adminCount !== 1) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "All other admins must be removed before deleting the team",
      });
    }
    await ctx.db.team.delete({ where: { id: ctx.team.id } });
    return true;
  }),

  getTeamImageUploadUrl: teamAdminProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.string().regex(/^image\//),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Object storage is not configured",
        });
      }
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const key = `team-images/${ctx.team.id}/${Date.now()}.${ext}`;
      return getPresignedUploadUrl(key, input.contentType);
    }),
});
