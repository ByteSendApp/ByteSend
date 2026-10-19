import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import {
  buildAuthorizeUrl,
  LINKED_ROLES_STATE_COOKIE,
  linkedRolesConfigured,
} from "~/server/service/discord-linked-roles-service";

export const dynamic = "force-dynamic";

// Discord sends members here (the app's "Linked Roles Verification URL") when they claim a role.
export async function GET() {
  if (!linkedRolesConfigured()) {
    return new NextResponse("Linked roles are not configured", { status: 404 });
  }

  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent("/api/discord/linked-roles")}`);
  }
  if (session.user.isBanned) {
    return NextResponse.redirect(`${base}/discord/linked-roles?status=error`);
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(LINKED_ROLES_STATE_COOKIE, state, {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/api/discord/linked-roles",
    maxAge: 10 * 60,
  });
  return response;
}
