import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type Adapter } from "next-auth/adapters";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { Provider } from "next-auth/providers/index";
import { sendSignUpEmail } from "~/server/mailer";
import { createEmailVerificationAdapter } from "~/server/email-adapter";
import { sendToDiscord } from "~/server/service/notification-service";
import { BlocklistService } from "~/server/service/blocklist-service";
import { compare } from "bcryptjs";

import { env } from "~/env";
import { db } from "~/server/db";
import { isOAuthEmailVerified, isOAuthProvider, recordProviderEmail } from "~/server/auth/oauth-email";

declare module "next-auth" {
  // eslint-disable-next-line no-unused-vars
  interface Session extends DefaultSession {
    user: {
      id: number;
      isBetaUser: boolean;
      isAdmin: boolean;
      isFounder: boolean;
      isEnvAdmin?: boolean;
      isBanned: boolean;
    } & DefaultSession["user"];
  }

  // eslint-disable-next-line no-unused-vars
  interface User {
    id: number;
    isBetaUser: boolean;
    isAdmin: boolean;
    isFounder: boolean;
    isEnvAdmin?: boolean;
    isBanned: boolean;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  // eslint-disable-next-line no-unused-vars
  interface JWT {
    isBanned?: boolean;
  }
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase();
}

function getProviders() {
  const providers: Provider[] = [];

  if (env.GITHUB_ID && env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: env.GITHUB_ID,
        clientSecret: env.GITHUB_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            scope: "read:user user:email",
          },
        },
      })
    );
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    providers.push(
      DiscordProvider({
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
        issuer: "https://discord.com",
      })
    );
  }

  providers.push(
    EmailProvider({
      server: {},
      from: env.FROM_EMAIL ?? "noreply@bytesend.cloud",
      maxAge: 24 * 60 * 60,
      generateVerificationToken() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let token = "";
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        for (const b of bytes) token += chars[b % chars.length];
        return token;
      },
      async sendVerificationRequest({ identifier: email, token, url }) {
        await sendSignUpEmail(email, token, url);
      },
    })
  );

  providers.push(
    CredentialsProvider({
      name: "Backup Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        const primaryUser = await db.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (primaryUser) {
          throw new Error(
            "Use the email link or sign in with your OAuth provider. Password login is only available for backup emails."
          );
        }

        const backupEmail = await db.backupEmail.findUnique({
          where: { email },
          select: {
            userId: true,
            passwordHash: true,
            emailVerified: true,
          },
        });

        if (!backupEmail) {
          throw new Error("Invalid email or password");
        }

        if (!backupEmail.emailVerified) {
          throw new Error(
            "This backup email is not verified. Please verify it in your account settings."
          );
        }

        const isPasswordValid = await compare(password, backupEmail.passwordHash);
        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        const user = await db.user.findUnique({
          where: { id: backupEmail.userId },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            isBetaUser: true,
            isAdmin: true,
            isBanned: true,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.isBanned) {
          throw new Error("BANNED");
        }

        return user;
      },
    })
  );

  if (providers.length === 0 && process.env.SKIP_ENV_VALIDATION !== "true") {
    throw new Error("No auth providers found, need atleast one");
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    signIn: async ({ user, account, profile, credentials }) => {
      if (user.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          select: { isBanned: true },
        });
        if (dbUser?.isBanned) {
          return "/login?error=banned";
        }
        // Only new sign-ups are checked, so blocking a domain never locks out existing accounts.
        if (!dbUser) {
          const blocked = await BlocklistService.findBlockedSignup(user.email);
          if (blocked) {
            sendToDiscord(
              `🚫 **Blocked sign-up**\n**Email:** ${user.email}\n**Matched:** ${blocked.type === "EMAIL" ? "blocked mailbox" : "blocked email domain"} \`${blocked.value}\`${blocked.sourceUserId ? ` (banned user #${blocked.sourceUserId})` : ""}`,
            ).catch(() => void 0);
            return "/login?error=blocked";
          }
        }
      }

      if (account?.provider === "email" && credentials?.code) {
        try {
          return true;
        } catch {
          return false;
        }
      }

      if (account && isOAuthProvider(account.provider)) {
        const emailVerified = await isOAuthEmailVerified({
          provider: account.provider,
          profile,
          accessToken: account.access_token,
          email: user.email,
        });
        if (!emailVerified) {
          return "/login?error=unverified_email";
        }
        await recordProviderEmail({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email,
        });

        let freshImage: string | null = null;
        if (account.provider === "github") {
          freshImage = (profile as { avatar_url?: string } | undefined)?.avatar_url ?? null;
        } else if (account.provider === "google") {
          freshImage = (profile as { picture?: string } | undefined)?.picture ?? null;
        } else if (account.provider === "discord") {
          const dp = profile as { image_url?: string; avatar?: string; id?: string } | undefined;
          freshImage =
            dp?.image_url ??
            (dp?.id && dp?.avatar
              ? `https://cdn.discordapp.com/avatars/${dp.id}/${dp.avatar}.png`
              : null);
        }

        if (freshImage && freshImage !== user.image) {
          try {
            await db.user.update({
              where: { id: typeof user.id === "string" ? parseInt(user.id, 10) : user.id },
              data: { image: freshImage },
            });
            user.image = freshImage;
          } catch { }
        }
      }

      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.isBanned = user.isBanned ?? false;
      }
      return token;
    },
    session: ({ session, user }) => {
      const userEmail = normalizeEmail(user.email);
      const founderEmail = normalizeEmail(env.FOUNDER_EMAIL);
      const adminEmail = normalizeEmail(env.ADMIN_EMAIL);

      const isFounder = !!founderEmail && userEmail === founderEmail;
      const isEnvAdmin =
        isFounder ||
        (!!adminEmail && userEmail === adminEmail);
      const isAdmin =
        isEnvAdmin ||
        user.isAdmin;
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          isBetaUser: user.isBetaUser,
          isAdmin,
          isFounder,
          isEnvAdmin,
          isBanned: user.isBanned ?? false,
          image: user.image ?? session.user.image,
        },
      };
    },
  },
  adapter: createEmailVerificationAdapter() as Adapter,
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login?error=callback",
  },
  events: {
    linkAccount: async ({ user, account, profile }) => {
      await recordProviderEmail({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email: profile.email ?? user.email,
      });
    },
    createUser: async ({ user }) => {
      sendToDiscord(`**New user signed up** 🎉\n**Email:** ${user.email ?? "unknown"}\n**Name:** ${user.name ?? "—"}`).catch(() => void 0);

      let invitesAvailable = false;

      if (user.email) {
        const invites = await db.teamInvite.findMany({
          where: { email: user.email },
        });

        invitesAvailable = invites.length > 0;
      }

      if (
        !env.NEXT_PUBLIC_IS_CLOUD ||
        env.NODE_ENV === "development" ||
        invitesAvailable
      ) {
        await db.user.update({
          where: { id: user.id },
          data: { isBetaUser: true },
        });
      } else {
        await db.user.update({
          where: { id: user.id },
          data: { isBetaUser: true },
        });
      }
    },
  },
  providers: getProviders(),
};

export const getServerAuthSession = () => getServerSession(authOptions);
