import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockDb,
    mockSendEmailChangeVerificationEmail,
    mockVerifyTwoFactorToken,
    mockGenerateTwoFactorSecret,
    mockGenerateRecoveryCodes,
    mockHashRecoveryCode,
    mockVerifyRecoveryCode,
} = vi.hoisted(() => ({
    mockDb: {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        account: {
            findMany: vi.fn(),
        },
        pendingEmailChange: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        twoFactorRecoveryCode: {
            findMany: vi.fn(),
            deleteMany: vi.fn(),
            createMany: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
        },
    },
    mockSendEmailChangeVerificationEmail: vi.fn(),
    mockVerifyTwoFactorToken: vi.fn(),
    mockGenerateTwoFactorSecret: vi.fn(),
    mockGenerateRecoveryCodes: vi.fn(),
    mockHashRecoveryCode: vi.fn(),
    mockVerifyRecoveryCode: vi.fn(),
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/auth", () => ({ getServerAuthSession: vi.fn() }));
vi.mock("~/server/mailer", () => ({
    sendEmailChangeVerificationEmail: mockSendEmailChangeVerificationEmail,
}));
vi.mock("~/server/security/two-factor", () => ({
    verifyTwoFactorToken: mockVerifyTwoFactorToken,
    generateTwoFactorSecret: mockGenerateTwoFactorSecret,
}));
vi.mock("~/server/security/recovery-codes", () => ({
    generateRecoveryCodes: mockGenerateRecoveryCodes,
    hashRecoveryCode: mockHashRecoveryCode,
    verifyRecoveryCode: mockVerifyRecoveryCode,
}));

import { createCallerFactory } from "~/server/api/trpc";
import { userRouter } from "~/server/api/routers/user";

const createCaller = createCallerFactory(userRouter);

function getCtx(overrides?: Partial<{ twoFactorVerified: boolean }>) {
    return {
        db: mockDb,
        headers: new Headers(),
        twoFactorVerified: true,
        session: {
            user: {
                id: 1,
                email: "user@example.com",
                isAdmin: false,
                isBetaUser: false,
            },
        },
        ...overrides,
    } as any;
}

describe("userRouter.requestEmailChange", () => {
    beforeEach(() => {
        mockDb.user.findUnique.mockReset();
        mockDb.user.findFirst.mockReset();
        mockDb.pendingEmailChange.upsert.mockReset();
        mockSendEmailChangeVerificationEmail.mockReset();
    });

    it("rejects when new email same as current", async () => {
        mockDb.user.findUnique.mockResolvedValue({ id: 1, email: "user@example.com" });
        const caller = createCaller(getCtx());
        await expect(caller.requestEmailChange({ email: "user@example.com" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("rejects email already in use by another account", async () => {
        mockDb.user.findUnique.mockResolvedValue({ id: 1, email: "user@example.com" });
        mockDb.user.findFirst.mockResolvedValue({ id: 2 });
        const caller = createCaller(getCtx());
        await expect(caller.requestEmailChange({ email: "taken@example.com" })).rejects.toMatchObject({
            code: "CONFLICT",
        });
    });

    it("sends a code to both the current and the new address", async () => {
        mockDb.user.findUnique.mockResolvedValue({ id: 1, email: "user@example.com" });
        mockDb.user.findFirst.mockResolvedValue(null);
        mockDb.pendingEmailChange.upsert.mockResolvedValue({});
        mockSendEmailChangeVerificationEmail.mockResolvedValue(undefined);
        const caller = createCaller(getCtx());

        const result = await caller.requestEmailChange({ email: "new@example.com" });

        expect(result).toMatchObject({ step: "verify_old", currentEmail: "user@example.com", newEmail: "new@example.com" });
        expect(mockSendEmailChangeVerificationEmail).toHaveBeenCalledWith("user@example.com", expect.any(String), expect.any(String));
        expect(mockSendEmailChangeVerificationEmail).toHaveBeenCalledWith("new@example.com", expect.any(String), expect.any(String));
    });

    it("allows accounts linked to OAuth providers to change email", async () => {
        mockDb.user.findUnique.mockResolvedValue({ id: 1, email: "user@example.com" });
        mockDb.user.findFirst.mockResolvedValue(null);
        mockDb.pendingEmailChange.upsert.mockResolvedValue({});
        mockSendEmailChangeVerificationEmail.mockResolvedValue(undefined);
        const caller = createCaller(getCtx());

        await expect(caller.requestEmailChange({ email: "provider@example.com" })).resolves.toMatchObject({
            step: "verify_old",
        });
    });
});

const pending = (overrides: Record<string, unknown> = {}) => ({
    id: "p1",
    codeOld: "OLD123",
    codeNew: "NEW456",
    verifiedOld: false,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
});

describe("userRouter.confirmOldEmail", () => {
    beforeEach(() => {
        mockDb.pendingEmailChange.findUnique.mockReset();
        mockDb.pendingEmailChange.update.mockReset();
        mockDb.pendingEmailChange.delete.mockReset();
    });

    it("rejects when no change is pending", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(null);
        const caller = createCaller(getCtx());
        await expect(caller.confirmOldEmail({ email: "new@example.com", code: "OLD123" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("rejects and clears an expired request", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(pending({ expiresAt: new Date(Date.now() - 1000) }));
        const caller = createCaller(getCtx());
        await expect(caller.confirmOldEmail({ email: "new@example.com", code: "OLD123" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(mockDb.pendingEmailChange.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });

    it("rejects the new address's code", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(pending());
        const caller = createCaller(getCtx());
        await expect(caller.confirmOldEmail({ email: "new@example.com", code: "NEW456" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("marks the current address verified", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(pending());
        mockDb.pendingEmailChange.update.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.confirmOldEmail({ email: "new@example.com", code: "old123" });
        expect(result.step).toBe("verify_new");
        expect(mockDb.pendingEmailChange.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { verifiedOld: true } });
    });
});

describe("userRouter.confirmNewEmail", () => {
    beforeEach(() => {
        mockDb.pendingEmailChange.findUnique.mockReset();
        mockDb.pendingEmailChange.delete.mockReset();
        mockDb.user.findFirst.mockReset();
        mockDb.user.update.mockReset();
    });

    it("requires the current address to be verified first", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(pending());
        const caller = createCaller(getCtx());
        await expect(caller.confirmNewEmail({ email: "new@example.com", code: "NEW456" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it("updates the email once both codes are confirmed", async () => {
        mockDb.pendingEmailChange.findUnique.mockResolvedValue(pending({ verifiedOld: true }));
        mockDb.user.findFirst.mockResolvedValue(null);
        mockDb.user.update.mockResolvedValue({ id: 1, email: "new@example.com", emailVerified: new Date() });
        mockDb.pendingEmailChange.delete.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.confirmNewEmail({ email: "new@example.com", code: "NEW456" });
        expect(result.email).toBe("new@example.com");
        expect(mockDb.pendingEmailChange.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });
});

describe("userRouter.startTwoFactorSetup", () => {
    it("requires email on account", async () => {
        mockDb.user.findUnique.mockResolvedValue({ email: null });
        mockGenerateTwoFactorSecret.mockReturnValue({ secret: "S", otpauthUrl: "otpauth://..." });
        const caller = createCaller(getCtx());
        await expect(caller.startTwoFactorSetup()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("stores temp secret and returns otpauth URL", async () => {
        mockDb.user.findUnique.mockResolvedValue({ email: "user@example.com" });
        mockGenerateTwoFactorSecret.mockReturnValue({ secret: "MYSECRET", otpauthUrl: "otpauth://totp/..." });
        mockDb.user.update.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.startTwoFactorSetup();
        expect(result.secret).toBe("MYSECRET");
        expect(mockDb.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ twoFactorTempSecret: "MYSECRET" }) })
        );
    });
});

describe("userRouter.confirmTwoFactorSetup", () => {
    it("rejects if no setup in progress", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorTempSecret: null });
        const caller = createCaller(getCtx());
        await expect(caller.confirmTwoFactorSetup({ code: "123456" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects wrong TOTP code", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorTempSecret: "SECRET" });
        mockVerifyTwoFactorToken.mockResolvedValue(false);
        const caller = createCaller(getCtx());
        await expect(caller.confirmTwoFactorSetup({ code: "000000" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("enables 2FA and returns recovery codes on valid code", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorTempSecret: "SECRET" });
        mockVerifyTwoFactorToken.mockResolvedValue(true);
        mockDb.user.update.mockResolvedValue({});
        mockGenerateRecoveryCodes.mockReturnValue(["CODE1", "CODE2", "CODE3", "CODE4", "CODE5", "CODE6", "CODE7", "CODE8", "CODE9", "CODE10"]);
        mockHashRecoveryCode.mockImplementation((c: string) => `hash_${c}`);
        mockDb.twoFactorRecoveryCode.deleteMany.mockResolvedValue({});
        mockDb.twoFactorRecoveryCode.createMany.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.confirmTwoFactorSetup({ code: "123456" });
        expect(result.enabled).toBe(true);
        expect(result.recoveryCodes).toHaveLength(10);
    });
});

describe("userRouter.disableTwoFactor", () => {
    it("rejects if 2FA not enabled", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorEnabled: false, twoFactorSecret: null });
        const caller = createCaller(getCtx());
        await expect(caller.disableTwoFactor({ code: "123456" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects wrong code", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: "S" });
        mockVerifyTwoFactorToken.mockResolvedValue(false);
        const caller = createCaller(getCtx());
        await expect(caller.disableTwoFactor({ code: "000000" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("disables 2FA on valid code", async () => {
        mockDb.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: "S" });
        mockVerifyTwoFactorToken.mockResolvedValue(true);
        mockDb.user.update.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.disableTwoFactor({ code: "123456" });
        expect(result.enabled).toBe(false);
    });
});

describe("userRouter.useRecoveryCode", () => {
    it("rejects invalid recovery code", async () => {
        mockDb.twoFactorRecoveryCode.findMany.mockResolvedValue([{ id: "r1", codeHash: "hash_AABB" }]);
        mockVerifyRecoveryCode.mockReturnValue(false);
        const caller = createCaller(getCtx());
        await expect(caller.useRecoveryCode({ code: "BADCODE" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("marks recovery code used and returns remaining count", async () => {
        mockDb.twoFactorRecoveryCode.findMany.mockResolvedValue([
            { id: "r1", codeHash: "hash_AABB" },
            { id: "r2", codeHash: "hash_CCDD" },
        ]);
        mockVerifyRecoveryCode.mockImplementation((_code: string, hash: string) => hash === "hash_AABB");
        mockDb.twoFactorRecoveryCode.update.mockResolvedValue({});
        const caller = createCaller(getCtx());
        const result = await caller.useRecoveryCode({ code: "AABB" });
        expect(result.verified).toBe(true);
        expect(result.remaining).toBe(1);
    });
});
