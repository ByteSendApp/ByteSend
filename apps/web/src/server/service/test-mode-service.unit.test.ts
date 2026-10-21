import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Email } from "@prisma/client";

const { mockDb, mockEmit } = vi.hoisted(() => ({
  mockDb: {
    email: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    emailEvent: { create: vi.fn() },
  },
  mockEmit: vi.fn(),
}));

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./webhook-service", () => ({ WebhookService: { emit: mockEmit } }));

import { assertTestAllowance, simulatedOutcome, simulateTestEmail, TEST_EMAILS_PER_DAY } from "./test-mode-service";

function testEmail(to: string): Email {
  return {
    id: "email_1",
    teamId: 7,
    domainId: 3,
    to: [to],
    from: "hello@acme.com",
    subject: "Hi",
    isTest: true,
    latestStatus: "QUEUED",
    campaignId: null,
    contactId: null,
  } as unknown as Email;
}

const statuses = () => mockDb.emailEvent.create.mock.calls.map((call) => call[0].data.status);
const webhookTypes = () => mockEmit.mock.calls.map((call) => call[1]);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.email.updateMany.mockResolvedValue({ count: 1 });
  mockDb.email.count.mockResolvedValue(0);
});

describe("simulatedOutcome", () => {
  it("delivers by default and reads bounce or complaint from the address", () => {
    expect(simulatedOutcome(["jane@example.com"])).toBe("delivered");
    expect(simulatedOutcome(["jane+bounce@example.com"])).toBe("bounced");
    expect(simulatedOutcome(["Bounced@example.com"])).toBe("bounced");
    expect(simulatedOutcome(["complaint@example.com"])).toBe("complained");
    expect(simulatedOutcome(["jane@bounce.example.com"])).toBe("delivered");
  });
});

describe("simulateTestEmail", () => {
  it("plays out sent and delivered, with webhooks flagged as test", async () => {
    await simulateTestEmail(testEmail("jane@example.com"));
    expect(statuses()).toEqual(["SENT", "DELIVERED"]);
    expect(webhookTypes()).toEqual(["email.sent", "email.delivered"]);
    expect(mockEmit.mock.calls[1]![2]).toMatchObject({ id: "email_1", status: "DELIVERED", test: true });
    expect(mockDb.emailEvent.create.mock.calls[1]![0].data.data).toMatchObject({ simulated: true });
  });

  it("simulates a permanent bounce", async () => {
    await simulateTestEmail(testEmail("jane+bounce@example.com"));
    expect(statuses()).toEqual(["SENT", "BOUNCED"]);
    expect(mockEmit.mock.calls[1]![2]).toMatchObject({ bounce: { type: "Permanent", subType: "General" }, test: true });
  });

  it("simulates a complaint after delivery", async () => {
    await simulateTestEmail(testEmail("complaint@example.com"));
    expect(statuses()).toEqual(["SENT", "DELIVERED", "COMPLAINED"]);
  });

  it("does nothing for an email that was cancelled or already simulated", async () => {
    mockDb.email.updateMany.mockResolvedValue({ count: 0 });
    await simulateTestEmail(testEmail("jane@example.com"));
    expect(mockDb.emailEvent.create).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("assertTestAllowance", () => {
  it("allows sends up to the daily cap and refuses past it", async () => {
    mockDb.email.count.mockResolvedValue(TEST_EMAILS_PER_DAY - 2);
    await expect(assertTestAllowance(7, 2)).resolves.toBeUndefined();
    await expect(assertTestAllowance(7, 3)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
