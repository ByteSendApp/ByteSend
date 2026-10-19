import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: { account: { updateMany: vi.fn() } } }));
vi.mock("~/server/logger/log", () => ({ logger: { error: vi.fn() } }));

import { isOAuthEmailVerified } from "~/server/auth/oauth-email";

describe("isOAuthEmailVerified", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects Discord accounts whose email is unverified", async () => {
    await expect(
      isOAuthEmailVerified({ provider: "discord", profile: { verified: false }, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(false);
  });

  it("accepts verified Discord accounts", async () => {
    await expect(
      isOAuthEmailVerified({ provider: "discord", profile: { verified: true }, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(true);
  });

  it("requires Google's email_verified claim", async () => {
    await expect(
      isOAuthEmailVerified({ provider: "google", profile: {}, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(false);
    await expect(
      isOAuthEmailVerified({ provider: "google", profile: { email_verified: true }, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(true);
  });

  it("checks the GitHub email list for a verified match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { email: "other@b.co", verified: true },
          { email: "A@B.co", verified: true },
        ],
      }),
    );
    await expect(
      isOAuthEmailVerified({ provider: "github", profile: {}, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(true);
  });

  it("rejects GitHub emails that are present but unverified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ email: "a@b.co", verified: false }] }),
    );
    await expect(
      isOAuthEmailVerified({ provider: "github", profile: {}, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(false);
  });

  it("fails closed when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      isOAuthEmailVerified({ provider: "github", profile: {}, accessToken: "t", email: "a@b.co" }),
    ).resolves.toBe(false);
  });

  it("rejects sign-ins without an email", async () => {
    await expect(
      isOAuthEmailVerified({ provider: "discord", profile: { verified: true }, accessToken: "t", email: null }),
    ).resolves.toBe(false);
  });
});
