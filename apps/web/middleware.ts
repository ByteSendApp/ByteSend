import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { validateTwoFactorCookieEdge, TWO_FACTOR_COOKIE } from "~/lib/edge-2fa-utils";

const PROTECTED_PREFIXES = [
    "/admin",
    "/broadcasts",
    "/campaigns",
    "/contacts",
    "/dashboard",
    "/dev-settings",
    "/domains",
    "/emails",
    "/logs",
    "/payments",
    "/settings",
    "/suppressions",
    "/templates",
    "/webhooks",
];

const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

function matchesPrefix(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (!PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
        return NextResponse.next();
    }

    // Sessions are stored in the database, so the edge can only check that a session cookie exists;
    // the server validates it (and enforces bans and 2FA) on every request.
    const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSessionCookie) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
    }

    // Only populated if the app switches to JWT sessions; database sessions have no decodable token.
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        return NextResponse.next();
    }

    if (token.isBanned) {
        return NextResponse.redirect(new URL("/banned", request.url));
    }

    const cookieValue = request.cookies.get(TWO_FACTOR_COOKIE)?.value;
    const userId = token.sub ? parseInt(token.sub, 10) : null;

    if (cookieValue && userId) {
        const isValid = await validateTwoFactorCookieEdge(
            cookieValue,
            userId,
            process.env.NEXTAUTH_SECRET ?? "dev-secret",
        );
        if (!isValid) {
            const res = NextResponse.redirect(new URL("/auth/2fa-verify", request.url));
            res.cookies.delete(TWO_FACTOR_COOKIE);
            return res;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api/auth/callback|_next/static|_next/image|favicon.ico).*)",
    ],
};
