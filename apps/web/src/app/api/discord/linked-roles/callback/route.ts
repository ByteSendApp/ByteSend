import { NextResponse, type NextRequest } from "next/server";
import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import { logger } from "~/server/logger/log";
import {
  computeLinkedRoleMetadata,
  exchangeCode,
  LINKED_ROLES_STATE_COOKIE,
  linkedRolesConfigured,
  pushRoleConnection,
} from "~/server/service/discord-linked-roles-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!linkedRolesConfigured()) {
    return new NextResponse("Linked roles are not configured", { status: 404 });
  }

  const resultUrl = (status: "linked" | "cancelled" | "error") =>
    `${env.NEXTAUTH_URL.replace(/\/$/, "")}/discord/linked-roles?status=${status}`;
  const finish = (status: "linked" | "cancelled" | "error") => {
    const response = NextResponse.redirect(resultUrl(status));
    response.cookies.delete({ name: LINKED_ROLES_STATE_COOKIE, path: "/api/discord/linked-roles" });
    return response;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish("cancelled");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(LINKED_ROLES_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return finish("error");
  }

  const session = await getServerAuthSession();
  if (!session?.user || session.user.isBanned) return finish("error");

  try {
    const accessToken = await exchangeCode(code);
    const { metadata, platformUsername } = await computeLinkedRoleMetadata(session.user.id);
    await pushRoleConnection(accessToken, platformUsername, metadata);
    logger.info({ userId: session.user.id, paid: metadata.paid }, "[LinkedRoles]: Discord role connection updated");
    return finish("linked");
  } catch (error) {
    logger.error({ err: error, userId: session.user.id }, "[LinkedRoles]: Could not link Discord roles");
    return finish("error");
  }
}
