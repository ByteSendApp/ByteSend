import * as tldts from "tldts";
import { Prisma, SpamVerdict } from "@prisma/client";
import { db } from "../db";
import { env } from "~/env";
import { getRedis, redisKey } from "../redis";
import { logger } from "../logger/log";
import { BLACKLISTS, lookupDomain } from "./blacklist-service";
import { isPrivateSuffixHostname, isSharedHostname } from "~/lib/constants/shared-domains";
import { domainAgeDays, VERY_YOUNG_DOMAIN_DAYS, YOUNG_DOMAIN_DAYS } from "~/lib/constants/trust";
import { DomainAgeService } from "./domain-age-service";
import { AdminAuditService } from "./admin-audit-service";
import { TeamService } from "./team-service";
import {
  SPAM_AUTO_BLOCK_HOLDS,
  SPAM_AUTO_BLOCK_WINDOW_HOURS,
  SPAM_FLAG_SCORE,
  SPAM_HOLD_SCORE,
} from "~/lib/constants/spam";

export type SpamHit = { rule: string; score: number; detail?: string };
export type SpamResult = { score: number; verdict: SpamVerdict | null; hits: SpamHit[] };

export type SpamScanInput = {
  from: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  attachmentNames?: string[];
  teamCreatedAt?: Date;
  /** Filled in by SpamScanService.scan when not provided. */
  senderDomainRegisteredAt?: Date | null;
};

const PHISHING_PATTERNS = [
  /verify your (account|identity|wallet)/i,
  /account (has been|was|will be) (suspended|locked|disabled|limited)/i,
  /unusual (sign[- ]?in|login|activity)/i,
  /confirm your (identity|password|billing|payment)/i,
  /update your (payment|billing) (details|information|method)/i,
  /password (will )?expire/i,
  /(seed|recovery) phrase/i,
  /claim your (refund|prize|reward)/i,
  // German
  /(dein|ihr) konto[^.]{0,60}(gesperrt|deaktiviert|eingeschränkt|gelöscht)/i,
  /(vorübergehend|dauerhaft|endgültig) (gesperrt|deaktiviert)/i,
  /(verifizier|bestätig)\w* (sie |du )?(dein|ihr)e? (identität|konto|zahlungs\w*)/i,
  /ungewöhnliche (anmeldung|aktivität)/i,
  /zahlungs(daten|informationen|methode) (aktualisieren|bestätigen)/i,
  // French
  /votre compte[^.]{0,60}(suspendu|bloqué|désactivé|limité)/i,
  /(vérifiez|confirmez) votre (identité|compte|paiement)/i,
  // Spanish and Italian
  /su cuenta[^.]{0,60}(suspendida|bloqueada|desactivada)/i,
  /(verifique|confirme) su (identidad|cuenta)/i,
  /il tuo account[^.]{0,60}(sospeso|bloccato|disattivato)/i,
  // Dutch
  /uw (account|rekening)[^.]{0,60}(geblokkeerd|opgeschort|gedeactiveerd)/i,
];

const SPAM_PATTERNS = [
  /100% free/i,
  /act now/i,
  /limited time offer/i,
  /you('ve| have) been selected/i,
  /risk[- ]free/i,
  /no credit check/i,
  /double your (money|bitcoin|crypto)/i,
  /guaranteed (income|returns|profit)/i,
  /work from home and earn/i,
];

const IMPERSONATED_BRANDS = [
  "paypal",
  "apple",
  "microsoft",
  "office365",
  "amazon",
  "netflix",
  "google",
  "facebook",
  "instagram",
  "whatsapp",
  "chase",
  "wells fargo",
  "bank of america",
  "hsbc",
  "barclays",
  "dhl",
  "fedex",
  "usps",
  "royal mail",
  "irs",
  "hmrc",
  "coinbase",
  "binance",
  "metamask",
  "ebay",
  "kleinanzeigen",
  "vinted",
  "etsy",
  "booking.com",
  "airbnb",
  "docusign",
  "adobe",
  "icloud",
  "telekom",
  "vodafone",
  "sparkasse",
  "volksbank",
  "commerzbank",
  "deutsche bank",
  "postbank",
  "n26",
  "revolut",
  "santander",
  "dpd",
  "hermes",
  "gls",
  "deutsche post",
  "la poste",
  "correos",
  "postnl",
  "ameli",
  "impots",
];

const URL_SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "is.gd",
  "ow.ly",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "tiny.cc",
  "buff.ly",
]);

const DANGEROUS_EXTENSIONS =
  /\.(exe|scr|com|pif|bat|cmd|js|jse|vbs|vbe|wsf|hta|msi|jar|ps1|lnk|iso|img|docm|xlsm|pptm)$/i;

const LINK_REPUTATION_TTL_SECONDS = 6 * 60 * 60;
const LINK_REPUTATION_TIMEOUT_MS = 1_500;
const MAX_LINK_DOMAINS_CHECKED = 10;
const PHISHING_SCORE_CAP = 6;
const SPAM_PHRASE_SCORE_CAP = 4;

function stripTags(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFromHeader(from: string) {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const displayName = (match?.[1] ?? "").trim();
  const address = (match?.[2] ?? from).trim().toLowerCase();
  return { displayName, domain: address.split("@")[1] ?? "" };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractLinks(html: string) {
  const links: Array<{ href: string; text: string }> = [];
  const anchor = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    links.push({ href: (match[1] ?? "").trim(), text: stripTags(match[2] ?? "") });
  }
  return links;
}

export function scanContent(input: SpamScanInput): SpamHit[] {
  const hits: SpamHit[] = [];
  const html = input.html ?? "";
  const bodyText = [input.text ?? "", html ? stripTags(html) : ""].join(" ");
  const haystack = `${input.subject} ${bodyText}`;
  const links = html ? extractLinks(html) : [];
  const { displayName, domain: senderDomain } = parseFromHeader(input.from);

  let phishingScore = 0;
  for (const pattern of PHISHING_PATTERNS) {
    const match = haystack.match(pattern);
    if (match && phishingScore < PHISHING_SCORE_CAP) {
      phishingScore += 3;
      hits.push({ rule: "phishing_phrase", score: 3, detail: match[0] });
    }
  }

  const lowerName = displayName.toLowerCase();
  const brand = IMPERSONATED_BRANDS.find(
    (name) => new RegExp(`\\b${name}\\b`).test(lowerName) && !senderDomain.includes(name.replace(/\s+/g, "")),
  );
  if (brand) {
    hits.push({ rule: "brand_impersonation", score: 6, detail: `"${displayName}" from ${senderDomain}` });
  }

  const seen = new Set<string>();
  for (const link of links) {
    const href = link.href;
    if (/^(javascript|data):/i.test(href)) {
      hits.push({ rule: "dangerous_link_scheme", score: 5, detail: href.slice(0, 60) });
      continue;
    }
    const host = hostOf(href);
    if (!host) continue;

    const visibleHost = hostOf(/^https?:\/\//i.test(link.text) ? link.text : `https://${link.text}`);
    const visibleLooksLikeDomain = /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(link.text.replace(/^https?:\/\//i, ""));
    if (
      visibleLooksLikeDomain &&
      visibleHost &&
      tldts.getDomain(visibleHost) !== tldts.getDomain(host) &&
      !seen.has(`mismatch:${host}`)
    ) {
      seen.add(`mismatch:${host}`);
      hits.push({ rule: "link_text_mismatch", score: 4, detail: `${link.text} → ${host}` });
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !seen.has(`ip:${host}`)) {
      seen.add(`ip:${host}`);
      hits.push({ rule: "ip_link", score: 4, detail: host });
    }
    const registrable = tldts.getDomain(host) ?? host;
    if (URL_SHORTENERS.has(registrable) && !seen.has(`short:${registrable}`)) {
      seen.add(`short:${registrable}`);
      hits.push({ rule: "url_shortener", score: 2, detail: registrable });
    }
    if (host.split(".").some((label) => label.startsWith("xn--")) && !seen.has(`puny:${host}`)) {
      seen.add(`puny:${host}`);
      hits.push({ rule: "punycode_link", score: 3, detail: host });
    }
  }

  for (const name of input.attachmentNames ?? []) {
    if (DANGEROUS_EXTENSIONS.test(name)) {
      hits.push({ rule: "dangerous_attachment", score: 8, detail: name });
    }
  }

  let spamScore = 0;
  for (const pattern of SPAM_PATTERNS) {
    const match = haystack.match(pattern);
    if (match && spamScore < SPAM_PHRASE_SCORE_CAP) {
      spamScore += 1;
      hits.push({ rule: "spam_phrase", score: 1, detail: match[0] });
    }
  }

  const subjectLetters = input.subject.replace(/[^a-z]/gi, "");
  if (subjectLetters.length >= 10 && subjectLetters.replace(/[^A-Z]/g, "").length / subjectLetters.length > 0.7) {
    hits.push({ rule: "shouting_subject", score: 2 });
  }

  if (/(!{3,}|\${3,})/.test(haystack)) {
    hits.push({ rule: "excessive_punctuation", score: 1 });
  }

  if (html && /<img\b/i.test(html) && stripTags(html).length < 40 && !(input.text ?? "").trim()) {
    hits.push({ rule: "image_only", score: 2 });
  }

  if (/(display\s*:\s*none|font-size\s*:\s*0(px)?\s*[;"'])/i.test(html)) {
    hits.push({ rule: "hidden_text", score: 2 });
  }

  // Hostnames on dynamic-DNS, tunnel and free-hosting services: nothing legitimate sends from them.
  if (isSharedHostname(senderDomain)) {
    hits.push({ rule: "shared_hostname_sender", score: 10, detail: senderDomain });
  } else if (isPrivateSuffixHostname(senderDomain)) {
    hits.push({ rule: "shared_namespace_sender", score: 2, detail: senderDomain });
  }

  if (input.senderDomainRegisteredAt) {
    const age = domainAgeDays(input.senderDomainRegisteredAt);
    if (age < VERY_YOUNG_DOMAIN_DAYS) {
      hits.push({ rule: "young_domain", score: 8, detail: `${senderDomain} registered ${age} day(s) ago` });
    } else if (age < YOUNG_DOMAIN_DAYS) {
      hits.push({ rule: "young_domain", score: 5, detail: `${senderDomain} registered ${age} days ago` });
    }
  }

  if (input.teamCreatedAt && Date.now() - input.teamCreatedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
    hits.push({ rule: "new_team", score: 2 });
  }

  return hits;
}

export function verdictFor(score: number): SpamVerdict | null {
  if (score >= SPAM_HOLD_SCORE) return SpamVerdict.HOLD;
  if (score >= SPAM_FLAG_SCORE) return SpamVerdict.FLAG;
  return null;
}

async function scanLinkReputation(html: string | null | undefined): Promise<SpamHit[]> {
  // Public DBL answers are refused from cloud resolvers, so lookups only add latency without a DQS key.
  if (!html || !env.SPAMHAUS_DQS_KEY) return [];
  const dbl = BLACKLISTS.find((list) => list.id === "spamhaus-dbl");
  if (!dbl) return [];

  const domains = [
    ...new Set(
      extractLinks(html)
        .map((link) => hostOf(link.href))
        .filter((host): host is string => !!host)
        .map((host) => tldts.getDomain(host) ?? host),
    ),
  ].slice(0, MAX_LINK_DOMAINS_CHECKED);

  const redis = getRedis();
  const results = await Promise.all(
    domains.map(async (domain) => {
      const cacheKey = redisKey(`spam:link-reputation:${domain}`);
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return { domain, status: cached };
      } catch {
        /* cache miss on Redis error */
      }
      const result = await lookupDomain(domain, dbl, LINK_REPUTATION_TIMEOUT_MS);
      if (result.status !== "ERROR") {
        await redis.set(cacheKey, result.status, "EX", LINK_REPUTATION_TTL_SECONDS).catch(() => undefined);
      }
      return { domain, status: result.status };
    }),
  );

  return results
    .filter((result) => result.status === "LISTED")
    .map((result) => ({ rule: "blacklisted_link", score: 10, detail: result.domain }));
}

export class SpamScanService {
  static async scan(input: SpamScanInput): Promise<SpamResult> {
    if (input.senderDomainRegisteredAt === undefined) {
      try {
        const senderDomain = parseFromHeader(input.from).domain;
        input = { ...input, senderDomainRegisteredAt: senderDomain ? await DomainAgeService.forSender(senderDomain) : null };
      } catch (error) {
        logger.warn({ err: error }, "[SpamScanService]: Domain age lookup failed");
      }
    }
    let hits = scanContent(input);
    try {
      hits = [...hits, ...(await scanLinkReputation(input.html))];
    } catch (error) {
      logger.warn({ err: error }, "[SpamScanService]: Link reputation check failed");
    }
    const score = hits.reduce((sum, hit) => sum + hit.score, 0);
    return { score, verdict: verdictFor(score), hits };
  }

  static async record({
    teamId,
    emailId,
    campaignId,
    result,
  }: {
    teamId: number;
    emailId?: string;
    campaignId?: string;
    result: SpamResult;
  }) {
    if (!result.verdict) return;
    await db.spamScan.create({
      data: {
        teamId,
        emailId,
        campaignId,
        score: result.score,
        verdict: result.verdict,
        hits: result.hits as unknown as Prisma.InputJsonArray,
      },
      select: { id: true },
    });

    logger.info(
      { teamId, emailId, campaignId, score: result.score, verdict: result.verdict },
      "[SpamScanService]: Message flagged",
    );

    if (result.verdict === SpamVerdict.HOLD) {
      await SpamScanService.autoBlockIfRepeated(teamId);
    }
  }

  static async autoBlockIfRepeated(teamId: number) {
    const since = new Date(Date.now() - SPAM_AUTO_BLOCK_WINDOW_HOURS * 60 * 60 * 1000);
    const holds = await db.spamScan.count({
      where: { teamId, verdict: SpamVerdict.HOLD, createdAt: { gte: since } },
    });
    if (holds < SPAM_AUTO_BLOCK_HOLDS) return;

    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true, isBlocked: true } });
    if (!team || team.isBlocked) return;

    await db.team.update({ where: { id: teamId }, data: { isBlocked: true } });
    await TeamService.invalidateTeamCache(teamId);
    await AdminAuditService.record({
      actor: null,
      action: "team.block",
      targetType: "team",
      targetId: teamId,
      metadata: {
        teamName: team.name,
        reason: `Automatic: ${holds} messages held for spam in ${SPAM_AUTO_BLOCK_WINDOW_HOURS}h`,
      },
    });
    logger.warn({ teamId, holds }, "[SpamScanService]: Team auto-blocked after repeated spam holds");
  }
}
