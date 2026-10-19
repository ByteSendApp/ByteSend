import { describe, expect, it } from "vitest";
import { isPrivateSuffixHostname, isSharedHostname } from "./shared-domains";

describe("isSharedHostname", () => {
  it.each([
    "ds0elybh.homelinuxserver.org",
    "homelinuxserver.org",
    "foo.duckdns.org",
    "x.no-ip.org",
    "mail.hopto.org",
    "me.github.io",
    "app.vercel.app",
    "abc123.ngrok-free.app",
    "site.netlify.app",
  ])("blocks %s", (name) => {
    expect(isSharedHostname(name)).toBe(true);
  });

  it.each([
    "example.com",
    "mail.example.com",
    "example.co.uk",
    "bytesend.cloud",
    "nodebyte.co.uk",
    // Paid registration namespaces the Public Suffix List marks "private": real, owned domains.
    "acme.uk.com",
    "acme.us.com",
    "acme.co.nl",
    "acme.co.no",
    "acme.com.de",
    "acme.eu.org",
    // Lookalikes that merely contain a blocked name.
    "myduckdns.org",
    "github.com",
    "notvercel.app",
  ])("never blocks %s", (name) => {
    expect(isSharedHostname(name)).toBe(false);
  });
});

describe("isPrivateSuffixHostname", () => {
  it("flags paid namespaces for review without blocking them", () => {
    expect(isPrivateSuffixHostname("acme.uk.com")).toBe(true);
    expect(isSharedHostname("acme.uk.com")).toBe(false);
  });

  it("ignores ordinary domains", () => {
    expect(isPrivateSuffixHostname("example.com")).toBe(false);
  });
});
