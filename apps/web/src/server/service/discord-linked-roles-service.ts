import { env } from "~/env";
import { db } from "../db";

const DISCORD_API = "https://discord.com/api/v10";

export const LINKED_ROLES_STATE_COOKIE = "bs_linked_roles_state";

export function linkedRolesConfigured() {
  return Boolean(env.DISCORD_LINKED_ROLES_CLIENT_ID && env.DISCORD_LINKED_ROLES_CLIENT_SECRET);
}

function redirectUri() {
  return `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/discord/linked-roles/callback`;
}

export function buildAuthorizeUrl(state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_LINKED_ROLES_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "role_connections.write identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeCode(code: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_LINKED_ROLES_CLIENT_ID!,
      client_secret: env.DISCORD_LINKED_ROLES_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Discord token exchange failed (${response.status})`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Discord returned no access token");
  return body.access_token;
}

// Keys and types must match the metadata the support bot registers (apps/discord-bot/linked_roles.go).
// Discord expects every value as a string: booleans as "1"/"0", datetimes as ISO 8601.
export type LinkedRoleMetadata = {
  customer: "1";
  paid: "0" | "1";
  emails_sent: string;
  member_since: string;
};

export async function computeLinkedRoleMetadata(userId: number) {
  const [user, memberships] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, createdAt: true } }),
    db.teamUser.findMany({ where: { userId }, select: { teamId: true, team: { select: { plan: true } } } }),
  ]);
  if (!user) throw new Error("User not found");

  const teamIds = memberships.map((membership) => membership.teamId);
  const usage = teamIds.length
    ? await db.dailyEmailUsage.aggregate({ where: { teamId: { in: teamIds } }, _sum: { sent: true } })
    : null;

  const metadata: LinkedRoleMetadata = {
    customer: "1",
    paid: memberships.some((membership) => membership.team.plan !== "FREE") ? "1" : "0",
    emails_sent: String(usage?._sum.sent ?? 0),
    member_since: user.createdAt.toISOString(),
  };
  // Shown publicly on the member's Discord profile, so never use the email address here.
  return { metadata, platformUsername: user.name?.trim() || "ByteSend user" };
}

export async function pushRoleConnection(
  accessToken: string,
  platformUsername: string,
  metadata: LinkedRoleMetadata,
) {
  const response = await fetch(
    `${DISCORD_API}/users/@me/applications/${env.DISCORD_LINKED_ROLES_CLIENT_ID}/role-connection`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platform_name: "ByteSend", platform_username: platformUsername.slice(0, 100), metadata }),
    },
  );
  if (!response.ok) {
    throw new Error(`Discord role connection update failed (${response.status})`);
  }
}
