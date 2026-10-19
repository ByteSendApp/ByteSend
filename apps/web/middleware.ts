import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { validateTwoFactorCookieEdge, TWO_FACTOR_COOKIE } from "~/lib/edge-2fa-utils";

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    const publicPaths = [
        "/login",
        "/signup",
        "/banned",
        "/api",
        "/auth",
        "/",
        "/privacy",
        "/terms",
        "/cookie-policy",
        "/dmca",
        "/dpa",
        "/acceptable-use",
        "/legal",
        "/changelog",
        "/_next",
        "/favicon.ico",
    ];

    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    if (pathname.startsWith("/dashboard") || pathname.startsWith("/broadcasts") || pathname.startsWith("/campaigns")) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

        if (!token) {
            return NextResponse.redirect(new URL("/login", request.url));
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
                process.env.NEXTAUTH_SECRET ?? "dev-secret"
            );
            if (!isValid) {
                const url = new URL("/auth/2fa-verify", request.url);
                const res = NextResponse.redirect(url);
                res.cookies.delete(TWO_FACTOR_COOKIE);
                return res;
            }
            return NextResponse.next();
        }

        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!api/auth/callback|_next/static|_next/image|favicon.ico).*)",
    ],
};
