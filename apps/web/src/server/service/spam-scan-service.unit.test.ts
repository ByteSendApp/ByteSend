import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/redis", () => ({ getRedis: vi.fn(), redisKey: (key: string) => key }));
vi.mock("~/server/logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("~/env", () => ({ env: { SPAMHAUS_DQS_KEY: undefined } }));
vi.mock("~/server/service/team-service", () => ({ TeamService: {} }));
vi.mock("~/server/service/admin-audit-service", () => ({ AdminAuditService: {} }));
vi.mock("~/server/service/blacklist-service", () => ({ BLACKLISTS: [], lookupDomain: vi.fn() }));
vi.mock("~/server/service/domain-age-service", () => ({ DomainAgeService: { forSender: vi.fn().mockResolvedValue(null) } }));

import { SpamScanService, extractLinks, scanContent, verdictFor } from "~/server/service/spam-scan-service";

const rules = (hits: Array<{ rule: string }>) => hits.map((hit) => hit.rule);

describe("scanContent: legitimate mail", () => {
  it("does not flag a password reset email", async () => {
    const result = await SpamScanService.scan({
      from: "Acme <no-reply@acme.io>",
      subject: "Reset your password",
      html: '<p>Someone asked to reset your Acme password.</p><p><a href="https://app.acme.io/reset?token=abc">Reset password</a></p><p>If this wasn\'t you, ignore this email.</p>',
      text: "Someone asked to reset your Acme password.",
    });
    expect(result.verdict).toBeNull();
  });

  it("does not flag an email verification code", async () => {
    const result = await SpamScanService.scan({
      from: "ByteSend <no-reply@bytesend.cloud>",
      subject: "Your verification code",
      html: "<p>Your code is <strong>K7Q2ZP</strong>. It expires in 10 minutes.</p>",
    });
    expect(result.verdict).toBeNull();
  });

  it("does not flag a receipt with a link whose text matches its domain", async () => {
    const result = await SpamScanService.scan({
      from: "Shop <orders@shop.example>",
      subject: "Your receipt #1042",
      html: '<p>Thanks for your order.</p><a href="https://shop.example/orders/1042">shop.example/orders/1042</a>',
    });
    expect(result.verdict).toBeNull();
  });

  it("does not treat a brand that matches the sender domain as impersonation", () => {
    expect(rules(scanContent({ from: "PayPal <service@paypal.com>", subject: "Receipt", html: "<p>Hi</p>" }))).not.toContain(
      "brand_impersonation",
    );
  });
});

describe("scanContent: phishing and abuse", () => {
  it("holds credential phishing that impersonates a brand with a mismatched link", async () => {
    const result = await SpamScanService.scan({
      from: "PayPal Security <alerts@secure-login-help.xyz>",
      subject: "Your account has been suspended",
      html: '<p>We noticed unusual sign-in activity. Verify your account now.</p><a href="http://198.51.100.7/login">www.paypal.com</a>',
    });
    expect(result.verdict).toBe("HOLD");
    expect(rules(result.hits)).toEqual(
      expect.arrayContaining(["phishing_phrase", "brand_impersonation", "link_text_mismatch", "ip_link"]),
    );
  });

  it("holds the Kleinanzeigen phishing sent from a dynamic-DNS hostname", async () => {
    const result = await SpamScanService.scan({
      from: '"kleinanzeigen" <support@ds0elybh.homelinuxserver.org>',
      subject: "E-Mail-Adresse bestätigen",
      html:
        "<h1>E-Mail-Adresse bestätigen</h1><p>Hallo, aufgrund eines neuen Sicherheitssystems bitten wir dich, deine E-Mail-Adresse zu bestätigen.</p>" +
        "<p><b>Wichtiger Hinweis:</b> Bitte bestätige deine Adresse innerhalb von 24 Stunden, da dein Konto andernfalls vorübergehend gesperrt wird.</p>",
      teamCreatedAt: new Date(),
    });
    expect(result.verdict).toBe("HOLD");
    expect(rules(result.hits)).toEqual(
      expect.arrayContaining(["phishing_phrase", "brand_impersonation", "shared_hostname_sender"]),
    );
  });

  it("holds anything sent from a dynamic-DNS hostname, even with harmless content", async () => {
    const result = await SpamScanService.scan({
      from: "Updates <hi@abc.duckdns.org>",
      subject: "Hello",
      html: "<p>Just saying hi.</p>",
    });
    expect(result.verdict).toBe("HOLD");
  });

  it("does not flag a real German sign-up confirmation from the sender's own domain", async () => {
    const result = await SpamScanService.scan({
      from: "Kleinanzeigen <noreply@kleinanzeigen.de>",
      subject: "Bitte bestätige deine E-Mail-Adresse",
      html: '<p>Hallo, bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.</p><a href="https://www.kleinanzeigen.de/confirm">Bestätigen</a>',
    });
    expect(result.verdict).toBeNull();
  });

  it("only lightly scores paid namespaces like uk.com, never holding them", async () => {
    const result = await SpamScanService.scan({
      from: "Acme <hello@acme.uk.com>",
      subject: "Your order has shipped",
      html: "<p>Thanks for your order.</p>",
    });
    expect(result.verdict).toBeNull();
    expect(rules(result.hits)).toEqual(["shared_namespace_sender"]);
  });

  it("does not treat newsletters with common words in their name as impersonation", () => {
    const hits = scanContent({ from: "The Outlook Weekly <news@outlookweekly.example>", subject: "This week", html: "<p>Hi</p>" });
    expect(rules(hits)).not.toContain("brand_impersonation");
  });

  it("scores newly registered sending domains, more for very young ones", () => {
    const base = { from: "Shop <hi@new-shop.example>", subject: "Hello", html: "<p>Hi</p>" };
    const day = 24 * 60 * 60 * 1000;
    const veryYoung = scanContent({ ...base, senderDomainRegisteredAt: new Date(Date.now() - 2 * day) });
    const young = scanContent({ ...base, senderDomainRegisteredAt: new Date(Date.now() - 20 * day) });
    const established = scanContent({ ...base, senderDomainRegisteredAt: new Date(Date.now() - 400 * day) });
    expect(veryYoung.find((hit) => hit.rule === "young_domain")?.score).toBe(8);
    expect(young.find((hit) => hit.rule === "young_domain")?.score).toBe(5);
    expect(rules(established)).not.toContain("young_domain");
  });

  it("holds mail from a brand-new team on a days-old domain", async () => {
    const result = await SpamScanService.scan({
      from: "Shop <hi@new-shop.example>",
      subject: "Hello",
      html: "<p>Hi</p>",
      teamCreatedAt: new Date(),
      senderDomainRegisteredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    expect(result.verdict).toBe("HOLD");
  });

  it("flags executable attachments", () => {
    const hits = scanContent({ from: "a@b.co", subject: "Invoice", text: "See attached", attachmentNames: ["invoice.pdf.exe"] });
    expect(rules(hits)).toContain("dangerous_attachment");
  });

  it("flags javascript: links, shorteners and punycode", () => {
    const hits = scanContent({
      from: "a@b.co",
      subject: "Hello",
      html: '<a href="javascript:alert(1)">x</a><a href="https://bit.ly/abc">here</a><a href="https://xn--pypal-4ve.com">link</a>',
    });
    expect(rules(hits)).toEqual(expect.arrayContaining(["dangerous_link_scheme", "url_shortener", "punycode_link"]));
  });

  it("caps repeated spam phrases", () => {
    const hits = scanContent({
      from: "a@b.co",
      subject: "ACT NOW",
      text: "100% free! act now, limited time offer, risk-free, no credit check, guaranteed income, you have been selected",
    });
    const phraseScore = hits.filter((hit) => hit.rule === "spam_phrase").reduce((sum, hit) => sum + hit.score, 0);
    expect(phraseScore).toBeLessThanOrEqual(4);
  });

  it("adds a small new-team signal that cannot trigger a flag on its own", () => {
    const hits = scanContent({ from: "a@b.co", subject: "Hi", text: "Hello", teamCreatedAt: new Date() });
    const score = hits.reduce((sum, hit) => sum + hit.score, 0);
    expect(rules(hits)).toEqual(["new_team"]);
    expect(verdictFor(score)).toBeNull();
  });
});

describe("helpers", () => {
  it("maps scores to verdicts at the thresholds", () => {
    expect(verdictFor(4)).toBeNull();
    expect(verdictFor(5)).toBe("FLAG");
    expect(verdictFor(9)).toBe("FLAG");
    expect(verdictFor(10)).toBe("HOLD");
  });

  it("extracts hrefs and visible text", () => {
    expect(extractLinks('<a class="btn" href="https://x.io/a"><b>Open</b> app</a>')).toEqual([
      { href: "https://x.io/a", text: "Open app" },
    ]);
  });
});
