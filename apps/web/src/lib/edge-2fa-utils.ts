export const TWO_FACTOR_COOKIE = "bytesend_2fa";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export async function validateTwoFactorCookieEdge(
    cookieValue: string,
    sessionUserId: number,
    secret: string
): Promise<boolean> {
    try {
        const decoded = Buffer.from(cookieValue, "base64").toString("utf8");
        const { userId, ts, sig } = JSON.parse(decoded) as {
            userId: number;
            ts: number;
            sig: string;
        };

        if (userId !== sessionUserId) return false;

        if (Date.now() - ts > COOKIE_MAX_AGE * 1000) return false;

        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const message = new TextEncoder().encode(`${userId}:${ts}`);
        const signature = await crypto.subtle.sign("HMAC", key, message);
        const expectedSig = Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        if (expectedSig.length !== sig.length) return false;
        let diff = 0;
        for (let i = 0; i < expectedSig.length; i++) {
            diff |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
        }
        return diff === 0;
    } catch {
        return false;
    }
}
