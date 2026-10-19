import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetToken } = vi.hoisted(() => ({ mockGetToken: vi.fn() }));

vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));
vi.mock("~/lib/edge-2fa-utils", () => ({
  TWO_FACTOR_COOKIE: "bytesend_2fa",
  validateTwoFactorCookieEdge: vi.fn().mockResolvedValue(true),
}));

import { middleware } from "../middleware";

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, "https://bytesend.test"));
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

const location = (res: Response) => res.headers.get("location");

describe("middleware", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockGetToken.mockResolvedValue(null);
  });

  it.each(["/", "/privacy", "/login", "/changelog", "/api/v1/emails", "/join-team"])(
    "lets %s through without a session",
    async (path) => {
      const res = await middleware(request(path));
      expect(location(res)).toBeNull();
    },
  );

  it.each(["/dashboard", "/settings/account", "/admin/teams/4", "/domains/12"])(
    "sends anonymous visitors from %s to login with a callback",
    async (path) => {
      const res = await middleware(request(path));
      const target = new URL(location(res)!);
      expect(target.pathname).toBe("/login");
      expect(target.searchParams.get("callbackUrl")).toBe(path);
    },
  );

  it("does not treat look-alike paths as protected", async () => {
    const res = await middleware(request("/dashboarding"));
    expect(location(res)).toBeNull();
  });

  it("lets a request with a database session cookie through", async () => {
    const res = await middleware(request("/dashboard", { "next-auth.session-token": "abc" }));
    expect(location(res)).toBeNull();
  });

  it("accepts the secure cookie name used over HTTPS", async () => {
    const res = await middleware(request("/settings", { "__Secure-next-auth.session-token": "abc" }));
    expect(location(res)).toBeNull();
  });

  it("redirects banned users when a JWT is available", async () => {
    mockGetToken.mockResolvedValue({ sub: "1", isBanned: true });
    const res = await middleware(request("/dashboard", { "next-auth.session-token": "abc" }));
    expect(new URL(location(res)!).pathname).toBe("/banned");
  });
});
