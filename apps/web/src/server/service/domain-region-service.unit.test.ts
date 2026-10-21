import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainStatus, type Domain } from "@prisma/client";

const { mockSes, mockDb, mockGetSetting, mockEmitDomainEvent, mockCheckDkim, mockCheckMx } = vi.hoisted(() => ({
  mockSes: { addDomain: vi.fn(), deleteDomain: vi.fn(), getDomainIdentity: vi.fn() },
  mockDb: { domain: { update: vi.fn() } },
  mockGetSetting: vi.fn(),
  mockEmitDomainEvent: vi.fn(),
  mockCheckDkim: vi.fn(),
  mockCheckMx: vi.fn(),
}));

vi.mock("~/server/aws/ses", () => mockSes);
vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/logger/log", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("~/server/service/ses-settings-service", () => ({ SesSettingsService: { getSetting: mockGetSetting } }));
vi.mock("~/server/service/domain-service", () => ({
  checkDkimDnsRecord: mockCheckDkim,
  checkMxDnsRecord: mockCheckMx,
  emitDomainEvent: mockEmitDomainEvent,
  parseDomainStatus: (status?: string | null) =>
    status && ["NOT_STARTED", "PENDING", "SUCCESS", "FAILED", "TEMPORARY_FAILURE"].includes(status.toUpperCase())
      ? (status.toUpperCase() as DomainStatus)
      : DomainStatus.NOT_STARTED,
}));

import {
  DomainRegionService,
  RETIRE_OLD_REGION_AFTER_MS,
  buildRegionMoveRecords,
} from "~/server/service/domain-region-service";

function createDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 1,
    name: "example.com",
    teamId: 7,
    status: DomainStatus.SUCCESS,
    region: "us-east-1",
    clickTracking: false,
    openTracking: false,
    publicKey: "old-key",
    dkimSelector: "bytesend",
    dkimStatus: DomainStatus.SUCCESS,
    spfDetails: DomainStatus.SUCCESS,
    dmarcAdded: true,
    errorMessage: null,
    subdomain: null,
    sesTenantId: null,
    isVerifying: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    pendingRegion: null,
    pendingDkimSelector: null,
    pendingPublicKey: null,
    pendingDkimStatus: null,
    pendingMailFromStatus: null,
    regionMoveStartedAt: null,
    retiredRegion: null,
    retiredRegionAt: null,
    registeredAt: null,
    registrationCheckedAt: null,
    dnsIssues: null,
    dnsIssuesSince: null,
    dnsIssuesNotifiedAt: null,
    dnsCheckedAt: null,
    inboundEnabled: false,
    inboundSubdomain: null,
    inboundStatus: null,
    inboundCheckedAt: null,
    inboundDkimSelector: null,
    inboundPublicKey: null,
    ...overrides,
  };
}

const moving = createDomain({
  pendingRegion: "eu-west-2",
  pendingDkimSelector: "bytesend-eu-west-2",
  pendingPublicKey: "new-key",
  pendingDkimStatus: DomainStatus.PENDING,
  pendingMailFromStatus: DomainStatus.PENDING,
  regionMoveStartedAt: new Date("2026-01-02T00:00:00.000Z"),
});

describe("DomainRegionService.start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.domain.update.mockImplementation(async ({ data }) => ({ ...createDomain(), ...data }));
  });

  it("registers the identity in the target region under a region-specific selector", async () => {
    mockGetSetting.mockResolvedValue({ region: "eu-west-2", isActive: true });
    mockSes.addDomain.mockResolvedValue("new-key");

    const updated = await DomainRegionService.start(createDomain(), "eu-west-2");

    expect(mockSes.addDomain).toHaveBeenCalledWith("example.com", "eu-west-2", undefined, "bytesend-eu-west-2");
    expect(updated).toMatchObject({
      region: "us-east-1",
      pendingRegion: "eu-west-2",
      pendingDkimSelector: "bytesend-eu-west-2",
      pendingPublicKey: "new-key",
    });
  });

  it.each([
    ["an unverified domain", createDomain({ status: DomainStatus.PENDING }), "eu-west-2"],
    ["the current region", createDomain(), "us-east-1"],
    ["a move already in progress", moving, "ap-south-1"],
    ["a region still being retired", createDomain({ retiredRegion: "us-west-2", retiredRegionAt: new Date() }), "eu-west-2"],
  ])("refuses %s", async (_label, domain, region) => {
    mockGetSetting.mockResolvedValue({ region, isActive: true });
    await expect(DomainRegionService.start(domain, region)).rejects.toThrow();
    expect(mockSes.addDomain).not.toHaveBeenCalled();
  });

  it("refuses inactive regions", async () => {
    mockGetSetting.mockResolvedValue({ region: "eu-west-2", isActive: false });
    await expect(DomainRegionService.start(createDomain(), "eu-west-2")).rejects.toThrow("not available");
  });
});

describe("DomainRegionService.refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.domain.update.mockImplementation(async ({ data }) => ({ ...moving, ...data }));
    mockCheckDkim.mockResolvedValue("found");
    mockCheckMx.mockResolvedValue("found");
  });

  it("keeps sending from the old region until DKIM and MAIL FROM both verify", async () => {
    mockSes.getDomainIdentity.mockResolvedValue({
      VerificationStatus: "SUCCESS",
      DkimAttributes: { Status: "SUCCESS" },
      MailFromAttributes: { MailFromDomainStatus: "PENDING" },
    });

    const result = await DomainRegionService.refresh(moving);

    expect(result.switched).toBe(false);
    expect(mockDb.domain.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { pendingDkimStatus: "SUCCESS", pendingMailFromStatus: "PENDING" },
    });
    expect(mockEmitDomainEvent).not.toHaveBeenCalled();
  });

  it("switches region, selector and key once the new identity is fully verified", async () => {
    mockSes.getDomainIdentity.mockResolvedValue({
      VerificationStatus: "SUCCESS",
      DkimAttributes: { Status: "SUCCESS" },
      MailFromAttributes: { MailFromDomainStatus: "SUCCESS" },
    });

    const result = await DomainRegionService.refresh(moving);

    expect(result.switched).toBe(true);
    expect(mockDb.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          region: "eu-west-2",
          dkimSelector: "bytesend-eu-west-2",
          publicKey: "new-key",
          retiredRegion: "us-east-1",
          pendingRegion: null,
        }),
      }),
    );
    expect(mockSes.deleteDomain).not.toHaveBeenCalled();
    expect(mockEmitDomainEvent).toHaveBeenCalledWith(expect.anything(), "domain.updated");
  });
});

describe("DomainRegionService.retireOldRegionIfDue", () => {
  const switchedAt = new Date("2026-01-03T00:00:00.000Z");
  const retired = createDomain({ region: "eu-west-2", retiredRegion: "us-east-1", retiredRegionAt: switchedAt });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.domain.update.mockResolvedValue(retired);
  });

  it("waits out the grace period before deleting the old identity", async () => {
    const done = await DomainRegionService.retireOldRegionIfDue(retired, switchedAt.getTime() + 60_000);
    expect(done).toBe(false);
    expect(mockSes.deleteDomain).not.toHaveBeenCalled();
  });

  it("deletes the old identity after the grace period", async () => {
    mockSes.deleteDomain.mockResolvedValue(true);
    const done = await DomainRegionService.retireOldRegionIfDue(
      retired,
      switchedAt.getTime() + RETIRE_OLD_REGION_AFTER_MS + 1,
    );
    expect(done).toBe(true);
    expect(mockSes.deleteDomain).toHaveBeenCalledWith("example.com", "us-east-1", undefined);
  });

  it("retries later when SES deletion fails", async () => {
    mockSes.deleteDomain.mockRejectedValue(Object.assign(new Error("throttled"), { name: "TooManyRequestsException" }));
    const done = await DomainRegionService.retireOldRegionIfDue(
      retired,
      switchedAt.getTime() + RETIRE_OLD_REGION_AFTER_MS + 1,
    );
    expect(done).toBe(false);
    expect(mockDb.domain.update).not.toHaveBeenCalled();
  });
});

describe("buildRegionMoveRecords", () => {
  it("returns the new DKIM TXT and MX records for the target region", () => {
    expect(buildRegionMoveRecords(moving)).toEqual([
      expect.objectContaining({ type: "TXT", name: "bytesend-eu-west-2._domainkey", value: "p=new-key" }),
      expect.objectContaining({ type: "MX", name: "mail", value: "feedback-smtp.eu-west-2.amazonses.com" }),
    ]);
  });

  it("returns null when no move is in progress", () => {
    expect(buildRegionMoveRecords(createDomain())).toBeNull();
  });
});
