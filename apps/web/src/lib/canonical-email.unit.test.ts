import { describe, expect, it } from "vitest";
import { canonicalEmail, domainAndParents, emailDomain } from "./canonical-email";

describe("canonicalEmail", () => {
  it("matches the plus-alias from the ban-evasion report", () => {
    expect(canonicalEmail("synccookiesmnx+1@gmail.com")).toBe(canonicalEmail("synccookiesmnx@gmail.com"));
  });

  it("ignores Gmail dots, case and googlemail.com", () => {
    expect(canonicalEmail("Sync.Cookies.MNX@GoogleMail.com")).toBe("synccookiesmnx@gmail.com");
  });

  it("strips plus tags on other providers but keeps their dots", () => {
    expect(canonicalEmail("first.last+news@outlook.com")).toBe("first.last@outlook.com");
  });

  it("keeps different mailboxes different", () => {
    expect(canonicalEmail("alice@example.com")).not.toBe(canonicalEmail("bob@example.com"));
    expect(canonicalEmail("a.b@example.com")).not.toBe(canonicalEmail("ab@example.com"));
  });

  it("leaves malformed input lowercased", () => {
    expect(canonicalEmail(" NotAnEmail ")).toBe("notanemail");
  });
});

describe("domain helpers", () => {
  it("extracts the email domain", () => {
    expect(emailDomain("x@Mail.Example.com")).toBe("mail.example.com");
    expect(emailDomain("nope")).toBeNull();
  });

  it("lists a domain and its parents, without the bare TLD", () => {
    expect(domainAndParents("a.b.example.com")).toEqual(["a.b.example.com", "b.example.com", "example.com"]);
    expect(domainAndParents("example.com")).toEqual(["example.com"]);
  });
});
