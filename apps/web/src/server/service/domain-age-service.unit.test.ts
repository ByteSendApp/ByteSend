import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/logger/log", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("~/server/service/notification-service", () => ({ sendToDiscord: vi.fn() }));

import { parseRdapRegistration } from "~/server/service/domain-age-service";

describe("parseRdapRegistration", () => {
  it("reads the registration event", () => {
    const date = parseRdapRegistration({
      events: [
        { eventAction: "last changed", eventDate: "2026-10-01T00:00:00Z" },
        { eventAction: "registration", eventDate: "2026-10-18T09:30:00Z" },
        { eventAction: "expiration", eventDate: "2027-10-18T09:30:00Z" },
      ],
    });
    expect(date?.toISOString()).toBe("2026-10-18T09:30:00.000Z");
  });

  it("returns null when the registry hides the date", () => {
    expect(parseRdapRegistration({ events: [{ eventAction: "last changed", eventDate: "2026-10-01T00:00:00Z" }] })).toBeNull();
    expect(parseRdapRegistration({})).toBeNull();
  });

  it("ignores malformed dates", () => {
    expect(parseRdapRegistration({ events: [{ eventAction: "registration", eventDate: "not a date" }] })).toBeNull();
  });
});
