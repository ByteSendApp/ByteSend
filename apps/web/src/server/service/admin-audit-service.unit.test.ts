import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockLogger } = vi.hoisted(() => ({
  mockDb: {
    adminAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
  mockLogger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/logger/log", () => ({ logger: mockLogger }));

import { AdminAuditService, diffFields } from "~/server/service/admin-audit-service";

describe("AdminAuditService.record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the actor, action and stringified target id", async () => {
    mockDb.adminAuditLog.create.mockResolvedValue({ id: "log_1" });

    await AdminAuditService.record({
      actor: { id: 7, email: "admin@example.com" },
      action: "team.delete",
      targetType: "team",
      targetId: 42,
      metadata: { teamName: "Acme" },
    });

    expect(mockDb.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 7,
          actorEmail: "admin@example.com",
          action: "team.delete",
          targetType: "team",
          targetId: "42",
          metadata: { teamName: "Acme" },
        }),
      }),
    );
  });

  it("never throws when the write fails", async () => {
    mockDb.adminAuditLog.create.mockRejectedValue(new Error("db down"));

    await expect(
      AdminAuditService.record({
        actor: { id: 1 },
        action: "user.ban",
        targetType: "user",
        targetId: 2,
      }),
    ).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledOnce();
  });
});

describe("AdminAuditService.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a next cursor only when more rows exist", async () => {
    mockDb.adminAuditLog.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);

    const page = await AdminAuditService.list({ limit: 2 });

    expect(page.entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    expect(mockDb.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it("omits the cursor on the last page", async () => {
    mockDb.adminAuditLog.findMany.mockResolvedValue([{ id: "a" }]);

    const page = await AdminAuditService.list({ limit: 2 });

    expect(page.nextCursor).toBeUndefined();
  });
});

describe("diffFields", () => {
  it("reports only changed, defined fields", () => {
    const before = { plan: "FREE", isBlocked: false, dailyEmailLimit: 100, extraDomainSlots: 0 };

    expect(
      diffFields(before, { plan: "BASIC", isBlocked: false, dailyEmailLimit: 100, extraDomainSlots: undefined }),
    ).toEqual({ plan: { from: "FREE", to: "BASIC" } });
  });
});
