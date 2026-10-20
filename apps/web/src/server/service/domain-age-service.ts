import * as tldts from "tldts";
import { db } from "../db";
import { logger } from "../logger/log";
import { domainAgeDays, YOUNG_DOMAIN_DAYS } from "~/lib/constants/trust";
import { sendToDiscord } from "./notification-service";

const RDAP_TIMEOUT_MS = 4_000;

type RdapResponse = { events?: Array<{ eventAction?: string; eventDate?: string }> };

/** Pulls the registration date out of an RDAP domain response, if the registry publishes one. */
export function parseRdapRegistration(body: RdapResponse): Date | null {
  const event = body.events?.find((e) => e.eventAction === "registration");
  if (!event?.eventDate) return null;
  const date = new Date(event.eventDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Looks up when a domain's registrable part was registered, via rdap.org (which redirects to the
 * right registry). Returns null when the registry doesn't support RDAP or hides the date (some
 * ccTLDs, e.g. .de), so those domains are never treated as young.
 */
export async function lookupRegistrationDate(name: string): Promise<Date | null> {
  const registrable = tldts.getDomain(name);
  if (!registrable) return null;
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(registrable)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return parseRdapRegistration((await response.json()) as RdapResponse);
  } catch (error) {
    logger.warn({ err: error, domain: registrable }, "[DomainAge]: RDAP lookup failed");
    return null;
  }
}

export const DomainAgeService = {
  /** Records the domain's registration date and alerts admins when it's newly registered. */
  async record(domainId: number, name: string, teamId: number) {
    const registeredAt = await lookupRegistrationDate(name);
    await db.domain.update({
      where: { id: domainId },
      data: { registeredAt, registrationCheckedAt: new Date() },
    });

    if (registeredAt && domainAgeDays(registeredAt) < YOUNG_DOMAIN_DAYS) {
      sendToDiscord(
        `🆕 **Newly registered domain added**\n**Domain:** \`${name}\`\n**Registered:** ${domainAgeDays(registeredAt)} day(s) ago\n**Team:** #${teamId}\nMail from it is scored more strictly by spam protection.`,
      ).catch(() => void 0);
    }
    return registeredAt;
  },

  /** Registration date for the domain an address sends from, looking it up once if it was never checked. */
  async forSender(senderDomain: string): Promise<Date | null> {
    const domain = await db.domain.findFirst({
      where: { name: senderDomain },
      select: { id: true, name: true, teamId: true, registeredAt: true, registrationCheckedAt: true },
    });
    if (!domain) return null;
    if (domain.registrationCheckedAt) return domain.registeredAt;
    return this.record(domain.id, domain.name, domain.teamId);
  },
};
