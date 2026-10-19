import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { compare } from "bcryptjs";
import { env } from "~/env";

/**
 * POST /api/auth/backup-email-login
 * Validates backup email + password login
 * Returns userId and 2FA status
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { email?: string; password?: string };
        const email = body.email?.trim().toLowerCase();
        const password = body.password;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        // Check primary email first: they should use OAuth or Email OTP
        const primaryUser = await db.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
            },
        });

        if (primaryUser) {
            return NextResponse.json(
                {
                    error: "Use the email link or sign in with your OAuth provider. Password login is only available for backup emails.",
                },
                { status: 401 }
            );
        }

        // Check backup email
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
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        if (!backupEmail.emailVerified) {
            return NextResponse.json(
                {
                    error: "This backup email is not verified. Please verify it in your account settings.",
                },
                { status: 401 }
            );
        }

        // Validate password
        const isPasswordValid = await compare(password, backupEmail.passwordHash);
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Get user to check 2FA status
        const user = await db.user.findUnique({
            where: { id: backupEmail.userId },
            select: {
                id: true,
                email: true,
                twoFactorEnabled: true,
                name: true,
                image: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // If no 2FA, create session directly
        if (!user.twoFactorEnabled) {
            // Create a temporary session identifier
            // Store user context to be used during the session creation
            const res = NextResponse.json({
                success: true,
                userId: user.id,
                email: user.email,
                requiresTwoFactor: false,
            });

            // Create a temporary auth token that will be used to establish the session
            // We'll use a signed JWT that NextAuth can recognize
            return res;
        }

        // If 2FA is enabled, return info needed for 2FA page
        return NextResponse.json({
            success: true,
            userId: user.id,
            email: user.email,
            requiresTwoFactor: true,
        });
    } catch (err) {
        console.error("Backup email login error:", err);
        return NextResponse.json(
            { error: "An error occurred during login" },
            { status: 500 }
        );
    }
}
