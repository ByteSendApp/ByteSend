import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { sendEmailChangeVerificationEmail, sendBackupEmailVerificationEmail } from "~/server/mailer";
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
} from "~/server/security/two-factor";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "~/server/security/recovery-codes";
import { hash, compare } from "bcryptjs";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) token += chars[b % chars.length];
  return token;
}

async function sendDualEmailVerificationCodes(
  oldEmail: string,
  newEmail: string,
  codeOld: string,
  codeNew: string,
) {
  const sendOldPromise = sendEmailChangeVerificationEmail(
    oldEmail,
    codeOld,
    "Verify your current email address to update your ByteSend account email",
  );

  const sendNewPromise = sendEmailChangeVerificationEmail(
    newEmail,
    codeNew,
    "Verify your new ByteSend account email address",
  );

  await Promise.all([sendOldPromise, sendNewPromise]);
}

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
        image: z.string().url("Must be a valid URL").optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name, image: input.image },
        select: { id: true, name: true, image: true },
      });
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        twoFactorEnabled: true,
        accounts: { select: { type: true, provider: true } },
      },
    });
  }),

  requestEmailChange: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextEmail = input.email.trim().toLowerCase();

      const currentUser = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, email: true },
      });

      if (!currentUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const oauthAccounts = await db.account.findMany({
        where: { userId: ctx.session.user.id, type: "oauth" },
        select: { provider: true },
      });
      if (oauthAccounts.length > 0) {
        const providers = oauthAccounts.map((a) => a.provider).join(", ");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Email changes are not allowed for accounts linked to OAuth providers (${providers}). Sign in with email to manage your email address.`,
        });
      }

      const currentEmail = currentUser.email?.trim().toLowerCase() ?? null;
      if (currentEmail === nextEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That is already your current account email.",
        });
      }

      const existingUser = await db.user.findFirst({
        where: {
          email: {
            equals: nextEmail,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== currentUser.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That email is already in use by another account.",
        });
      }

      const codeOld = generateCode();
      const codeNew = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.pendingEmailChange.upsert({
        where: {
          userId_newEmail: {
            userId: currentUser.id,
            newEmail: nextEmail,
          },
        },
        create: {
          userId: currentUser.id,
          newEmail: nextEmail,
          codeOld,
          codeNew,
          verifiedOld: false,
          verifiedNew: false,
          expiresAt,
        },
        update: {
          codeOld,
          codeNew,
          verifiedOld: false,
          verifiedNew: false,
          expiresAt,
        },
      });

      if (currentEmail) {
        await sendDualEmailVerificationCodes(currentEmail, nextEmail, codeOld, codeNew);
      }

      return {
        step: "verify_old" as const,
        message: "Verification codes sent to both your current and new email addresses",
        currentEmail,
        newEmail: nextEmail,
        expiresAt,
      };
    }),

  confirmOldEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        code: z
          .string()
          .trim()
          .toUpperCase()
          .length(6, "Verification code must be 6 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newEmail = input.email.trim().toLowerCase();
      const code = input.code.trim().toUpperCase();

      const pending = await db.pendingEmailChange.findUnique({
        where: {
          userId_newEmail: {
            userId: ctx.session.user.id,
            newEmail,
          },
        },
      });

      if (!pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending email change found for this email address.",
        });
      }

      if (pending.expiresAt < new Date()) {
        await db.pendingEmailChange.delete({ where: { id: pending.id } });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new email change.",
        });
      }

      if (!pending.codeOld || pending.codeOld !== code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code for your current email.",
        });
      }

      await db.pendingEmailChange.update({
        where: { id: pending.id },
        data: { verifiedOld: true },
      });

      const remainingMs = pending.expiresAt.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

      return {
        step: "verify_new" as const,
        message: "Your current email has been verified. Check your new email for the verification code.",
        newEmail,
        remainingMinutes,
      };
    }),

  confirmNewEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        code: z
          .string()
          .trim()
          .toUpperCase()
          .length(6, "Verification code must be 6 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newEmail = input.email.trim().toLowerCase();
      const code = input.code.trim().toUpperCase();

      const pending = await db.pendingEmailChange.findUnique({
        where: {
          userId_newEmail: {
            userId: ctx.session.user.id,
            newEmail,
          },
        },
      });

      if (!pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending email change found for this email address.",
        });
      }

      if (pending.expiresAt < new Date()) {
        await db.pendingEmailChange.delete({ where: { id: pending.id } });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new email change.",
        });
      }

      if (!pending.verifiedOld) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please verify your current email address first.",
        });
      }

      if (pending.codeNew !== code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code for your new email.",
        });
      }

      const existingUser = await db.user.findFirst({
        where: {
          email: {
            equals: newEmail,
            mode: "insensitive",
          },
          NOT: { id: ctx.session.user.id },
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That email is already in use by another account.",
        });
      }

      const updated = await db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          email: newEmail,
          emailVerified: new Date(),
        },
        select: { id: true, email: true, emailVerified: true },
      });

      await db.pendingEmailChange.delete({ where: { id: pending.id } });

      return {
        success: true,
        email: updated.email,
        emailVerified: updated.emailVerified,
        message: "Email address has been successfully updated and verified.",
      };
    }),

  bypassOldEmailWithRecoveryCode: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        recoveryCode: z.string().trim().toUpperCase(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newEmail = input.email.trim().toLowerCase();
      const recoveryCode = input.recoveryCode.trim().toUpperCase();

      const pending = await db.pendingEmailChange.findUnique({
        where: {
          userId_newEmail: {
            userId: ctx.session.user.id,
            newEmail,
          },
        },
      });

      if (!pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending email change found for this email address.",
        });
      }

      if (pending.expiresAt < new Date()) {
        await db.pendingEmailChange.delete({ where: { id: pending.id } });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new email change.",
        });
      }

      const recoveryCodes = await db.twoFactorRecoveryCode.findMany({
        where: {
          userId: ctx.session.user.id,
          used: false,
        },
        select: { id: true, codeHash: true },
      });

      if (recoveryCodes.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid recovery codes available. Contact support if you've lost access to your email.",
        });
      }

      const validCode = recoveryCodes.find((rc) => verifyRecoveryCode(recoveryCode, rc.codeHash));

      if (!validCode) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid recovery code.",
        });
      }

      await db.twoFactorRecoveryCode.update({
        where: { id: validCode.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      await db.pendingEmailChange.update({
        where: { id: pending.id },
        data: { verifiedOld: true },
      });

      const remainingMs = pending.expiresAt.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

      return {
        step: "verify_new" as const,
        message: "Your current email verification has been bypassed using a recovery code. Check your new email for the verification code.",
        newEmail,
        remainingMinutes,
      };
    }),

  startTwoFactorSetup: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true },
    });

    const email = user?.email?.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Add an account email before enabling 2FA.",
      });
    }

    const { secret, otpauthUrl } = generateTwoFactorSecret(email);

    await db.user.update({
      where: { id: ctx.session.user.id },
      data: { twoFactorTempSecret: secret },
    });

    return { secret, otpauthUrl };
  }),

  confirmTwoFactorSetup: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().length(6, "Authentication code must be 6 digits"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { twoFactorTempSecret: true },
      });

      if (!user?.twoFactorTempSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No 2FA setup in progress.",
        });
      }

      const valid = await verifyTwoFactorToken(input.code.trim(), user.twoFactorTempSecret);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid authentication code.",
        });
      }

      await db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: user.twoFactorTempSecret,
          twoFactorTempSecret: null,
        },
      });

      const plainCodes = generateRecoveryCodes();
      await db.twoFactorRecoveryCode.deleteMany({ where: { userId: ctx.session.user.id } });
      await db.twoFactorRecoveryCode.createMany({
        data: plainCodes.map((code) => ({
          userId: ctx.session.user.id,
          codeHash: hashRecoveryCode(code),
        })),
      });

      return { enabled: true, recoveryCodes: plainCodes };
    }),

  useRecoveryCode: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().toUpperCase(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const unusedCodes = await db.twoFactorRecoveryCode.findMany({
        where: { userId: ctx.session.user.id, used: false },
      });

      const match = unusedCodes.find((row) => verifyRecoveryCode(input.code, row.codeHash));

      if (!match) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or already-used recovery code.",
        });
      }

      await db.twoFactorRecoveryCode.update({
        where: { id: match.id },
        data: { used: true, usedAt: new Date() },
      });

      const remaining = unusedCodes.length - 1;
      return { verified: true, remaining };
    }),

  getRecoveryCodeCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.twoFactorRecoveryCode.count({
      where: { userId: ctx.session.user.id, used: false },
    });
    return { remaining: count };
  }),

  regenerateRecoveryCodes: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().length(6, "Authentication code must be 6 digits"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled." });
      }

      const valid = await verifyTwoFactorToken(input.code.trim(), user.twoFactorSecret);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authentication code." });
      }

      const plainCodes = generateRecoveryCodes();
      await db.twoFactorRecoveryCode.deleteMany({ where: { userId: ctx.session.user.id } });
      await db.twoFactorRecoveryCode.createMany({
        data: plainCodes.map((code) => ({
          userId: ctx.session.user.id,
          codeHash: hashRecoveryCode(code),
        })),
      });

      return { recoveryCodes: plainCodes };
    }),

  disableTwoFactor: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().length(6, "Authentication code must be 6 digits"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Two-factor authentication is not enabled.",
        });
      }

      const valid = await verifyTwoFactorToken(input.code.trim(), user.twoFactorSecret);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid authentication code.",
        });
      }

      await db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorTempSecret: null,
        },
      });

      return { enabled: false };
    }),

  verifyTwoFactorCode: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().length(6, "Authentication code must be 6 digits"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { verified: true };
      }

      const valid = await verifyTwoFactorToken(input.code.trim(), user.twoFactorSecret);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid authentication code.",
        });
      }

      return { verified: true };
    }),

  addBackupEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const backupEmail = input.email.trim().toLowerCase();
      const password = input.password;

      const existingBackup = await db.backupEmail.findUnique({
        where: { email: backupEmail },
      });

      if (existingBackup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already registered as a backup email.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { email: true },
      });

      if (user?.email?.toLowerCase() === backupEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot use your primary email as a backup email.",
        });
      }

      const userWithEmail = await db.user.findFirst({
        where: { email: { equals: backupEmail, mode: "insensitive" } },
        select: { id: true },
      });

      if (userWithEmail) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already in use by another account.",
        });
      }

      const passwordHash = await hash(password, 10);

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.pendingBackupEmailVerification.upsert({
        where: {
          userId_email: {
            userId: ctx.session.user.id,
            email: backupEmail,
          },
        },
        create: {
          userId: ctx.session.user.id,
          email: backupEmail,
          code,
          expiresAt,
        },
        update: {
          code,
          expiresAt,
        },
      });

      await sendBackupEmailVerificationEmail(backupEmail, code);

      return {
        step: "verify" as const,
        message: "Verification email sent to your backup email address",
        email: backupEmail,
        expiresAt,
        passwordHash,
      };
    }),

  verifyBackupEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        code: z
          .string()
          .trim()
          .toUpperCase()
          .length(6, "Verification code must be 6 characters"),
        passwordHash: z.string().describe("The bcrypt-hashed password from addBackupEmail response"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const backupEmail = input.email.trim().toLowerCase();
      const code = input.code.trim().toUpperCase();

      const pending = await db.pendingBackupEmailVerification.findUnique({
        where: {
          userId_email: {
            userId: ctx.session.user.id,
            email: backupEmail,
          },
        },
      });

      if (!pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending backup email verification found.",
        });
      }

      if (pending.expiresAt < new Date()) {
        await db.pendingBackupEmailVerification.delete({ where: { id: pending.id } });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please try again.",
        });
      }

      if (pending.code !== code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code.",
        });
      }

      await db.backupEmail.create({
        data: {
          userId: ctx.session.user.id,
          email: backupEmail,
          passwordHash: input.passwordHash,
          emailVerified: new Date(),
        },
      });

      await db.pendingBackupEmailVerification.delete({ where: { id: pending.id } });

      return {
        success: true,
        email: backupEmail,
        message: "Backup email added successfully.",
      };
    }),

  getBackupEmails: protectedProcedure.query(async ({ ctx }) => {
    const backups = await db.backupEmail.findMany({
      where: { userId: ctx.session.user.id, emailVerified: { not: null } },
      select: { id: true, email: true, createdAt: true, emailVerified: true },
      orderBy: { createdAt: "asc" },
    });

    return backups;
  }),

  deleteBackupEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const backupEmail = input.email.trim().toLowerCase();

      const verifiedBackups = await db.backupEmail.count({
        where: { userId: ctx.session.user.id, emailVerified: { not: null } },
      });

      if (verifiedBackups <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must keep at least one backup email for account recovery.",
        });
      }

      const deleted = await db.backupEmail.deleteMany({
        where: {
          userId: ctx.session.user.id,
          email: backupEmail,
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Backup email not found.",
        });
      }

      return {
        success: true,
        email: backupEmail,
        message: "Backup email removed.",
      };
    }),

  validatePasswordLogin: publicProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email("Must be a valid email"),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const password = input.password;

      const primaryUser = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
        },
      });

      if (primaryUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Use the email link or sign in with your OAuth provider. Password login is only available for backup emails.",
        });
      }

      const backupEmail = await db.backupEmail.findUnique({
        where: { email },
        select: {
          id: true,
          userId: true,
          passwordHash: true,
          emailVerified: true,
        },
      });

      if (!backupEmail) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      if (!backupEmail.emailVerified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This backup email is not verified. Please verify it in your account settings.",
        });
      }

      const isPasswordValid = await compare(password, backupEmail.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const user = await db.user.findUnique({
        where: { id: backupEmail.userId },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      return {
        userId: user.id,
        email: user.email,
        requiresTwoFactor: user.twoFactorEnabled,
      };
    }),

  listLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    return db.account.findMany({
      where: { userId: ctx.session.user.id, type: "oauth" },
      select: { id: true, provider: true, email: true },
      orderBy: { provider: "asc" },
    });
  }),

  unlinkAccount: protectedProcedure
    .input(z.object({ accountId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { email: true, accounts: { select: { id: true, type: true } } },
      });
      const account = user?.accounts.find((item) => item.id === input.accountId && item.type === "oauth");
      if (!user || !account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connected account not found" });
      }

      const remainingOAuth = user.accounts.filter((item) => item.type === "oauth" && item.id !== account.id).length;
      if (!user.email && remainingOAuth === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add an email address before disconnecting your only sign-in method",
        });
      }

      await db.account.delete({ where: { id: account.id } });
      return { success: true };
    }),
});
