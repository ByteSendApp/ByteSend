import { db } from "~/server/db";
import { logger } from "~/server/logger/log";

export const OAUTH_PROVIDERS = ["github", "google", "discord"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(provider: string | undefined): provider is OAuthProvider {
  return !!provider && (OAUTH_PROVIDERS as readonly string[]).includes(provider);
}

async function isGithubEmailVerified(accessToken: string | undefined, email: string) {
  if (!accessToken) return false;
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return false;
    const emails = (await response.json()) as Array<{ email: string; verified: boolean }>;
    return emails.some((entry) => entry.verified && entry.email.toLowerCase() === email.toLowerCase());
  } catch (error) {
    logger.error({ err: error }, "[OAuthEmail]: Failed to verify GitHub email");
    return false;
  }
}

// Every provider uses allowDangerousEmailAccountLinking, so an unverified provider email
// would let anyone who registers that address at the provider sign into the matching ByteSend account.
export async function isOAuthEmailVerified({
  provider,
  profile,
  accessToken,
  email,
}: {
  provider: OAuthProvider;
  profile: unknown;
  accessToken: string | undefined;
  email: string | null | undefined;
}) {
  if (!email) return false;
  const claims = (profile ?? {}) as { verified?: boolean; email_verified?: boolean };
  switch (provider) {
    case "discord":
      return claims.verified === true;
    case "google":
      return claims.email_verified === true;
    case "github":
      return isGithubEmailVerified(accessToken, email);
  }
}

export async function recordProviderEmail({
  provider,
  providerAccountId,
  email,
}: {
  provider: string;
  providerAccountId: string;
  email: string | null | undefined;
}) {
  if (!email) return;
  try {
    await db.account.updateMany({
      where: { provider, providerAccountId },
      data: { email: email.toLowerCase() },
    });
  } catch (error) {
    logger.error({ err: error, provider }, "[OAuthEmail]: Failed to record provider email");
  }
}
