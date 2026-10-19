import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { verifyTwoFactorToken } from "~/server/security/two-factor";
import { verifyRecoveryCode } from "~/server/security/recovery-codes";
import { env } from "~/env";

export const TWO_FACTOR_COOKIE = "bytesend_2fa";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

function signPayload(userId: number, ts: number): string {
    return createHmac("sha256", env.NEXTAUTH_SECRET ?? "dev-secret")
        .update(`${userId}:${ts}`)
        .digest("hex");
}

export function buildTwoFactorCookieValue(userId: number): string {
    const ts = Date.now();
    const sig = signPayload(userId, ts);
    return Buffer.from(JSON.stringify({ userId, ts, sig })).toString("base64");
}

export function validateTwoFactorCookie(cookieValue: string, sessionUserId: number): boolean {
    try {
        const { userId, ts, sig } = JSON.parse(Buffer.from(cookieValue, "base64").toString("utf8")) as {
            userId: number;
            ts: number;
            sig: string;
        };
        if (userId !== sessionUserId) return false;
        // Cookie expires after 12 hours
        if (Date.now() - ts > COOKIE_MAX_AGE * 1000) return false;
        const expected = signPayload(userId, ts);
        if (expected.length !== sig.length) return false;
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
            diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
        }
        return diff === 0;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { code?: string; recoveryCode?: string };
    try {
        body = await req.json() as { code?: string; recoveryCode?: string };
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        // 2FA not enabled: set cookie anyway so middleware passes
        const cookieValue = buildTwoFactorCookieValue(session.user.id);
        const res = NextResponse.json({ verified: true });
        res.cookies.set(TWO_FACTOR_COOKIE, cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: COOKIE_MAX_AGE,
            path: "/",
        });
        return res;
    }

    // TOTP path
    if (body.code) {
        const valid = await verifyTwoFactorToken(body.code.trim(), user.twoFactorSecret);
        if (!valid) {
            return NextResponse.json({ error: "Invalid authentication code." }, { status: 400 });
        }
    } else if (body.recoveryCode) {
        // Recovery code path
        const unusedCodes = await db.twoFactorRecoveryCode.findMany({
            where: { userId: session.user.id, used: false },
        });
        const match = unusedCodes.find((row) => verifyRecoveryCode(body.recoveryCode!, row.codeHash));
        if (!match) {
            return NextResponse.json({ error: "Invalid or already-used recovery code." }, { status: 400 });
        }
        await db.twoFactorRecoveryCode.update({
            where: { id: match.id },
            data: { used: true, usedAt: new Date() },
        });
    } else {
        return NextResponse.json({ error: "Provide code or recoveryCode." }, { status: 400 });
    }

    const cookieValue = buildTwoFactorCookieValue(session.user.id);
    const res = NextResponse.json({ verified: true });
    res.cookies.set(TWO_FACTOR_COOKIE, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });
    return res;
}
