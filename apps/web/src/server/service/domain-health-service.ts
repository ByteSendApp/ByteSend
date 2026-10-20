import { DomainStatus, Prisma } from "@prisma/client";
import { env } from "~/env";
import { db } from "../db";
import { logger } from "../logger/log";
import { sendMail } from "../mailer";
import { checkDomainDnsHealth } from "./domain-service";
import { NotificationEmitter } from "./notification-emitter";
import { TeamService } from "./team-service";

const BATCH_SIZE = 10;

export type DnsHealthTransition = "first_seen" | "notify_broken" | "still_broken" | "notify_fixed" | "healthy";

/**
 * Decides what to do with a check result. A problem has to show up on two checks in a row before
 * anyone is told, so a DNS provider's brief hiccup or a slow propagation doesn't send an alert.
 */
export function dnsHealthTransition(state: {
  issues: string[];
  previousIssues: string[];
  notified: boolean;
}): DnsHealthTransition {
  if (state.issues.length === 0) return state.notified ? "notify_fixed" : "healthy";
  if (state.previousIssues.length === 0) return "first_seen";
  return state.notified ? "still_broken" : "notify_broken";
}

async function notifyTeam(
  domain: { teamId: number; name: string; id: number },
  issues: string[],
  resolved: boolean,
) {
  const team = await TeamService.getTeamCached(domain.teamId);
  const url = `${env.NEXTAUTH_URL}/domains/${domain.id}`;
  const subject = resolved
    ? `ByteSend: DNS for ${domain.name} is fixed`
    : `ByteSend: DNS problem on ${domain.name}`;
  const list = issues.map((issue) => `- ${issue}`).join("\n");
  const text = resolved
    ? `Hi ${team.name} team,\n\nThe DNS records for ${domain.name} are back in place. No action needed.\n\n${url}`
    : `Hi ${team.name} team,\n\nWe re-checked ${domain.name} and some DNS records ByteSend needs have changed:\n\n${list}\n\nUntil they're restored, email from this domain may fail to send or land in spam. The domain page shows the exact records to add:\n${url}`;
  const html = resolved
    ? `<p>Hi ${team.name} team,</p><p>The DNS records for <strong>${domain.name}</strong> are back in place. No action needed.</p>`
    : `<p>Hi ${team.name} team,</p><p>We re-checked <strong>${domain.name}</strong> and some DNS records ByteSend needs have changed:</p><ul>${issues
        .map((issue) => `<li>${issue}</li>`)
        .join("")}</ul><p>Until they're restored, email from this domain may fail to send or land in spam.</p><p><a href="${url}">See the records to add</a></p>`;

  const recipients = (await TeamService.getTeamUsers(domain.teamId))
    .map((tu) => tu.user?.email)
    .filter((e): e is string => Boolean(e));
  await Promise.allSettled(recipients.map((to) => sendMail(to, subject, text, html, "hey@bytesend.cloud")));
  await NotificationEmitter.emitDomainHealth(domain.teamId, { domainName: domain.name, issues, resolved }).catch((error) =>
    logger.warn({ err: error, domainId: domain.id }, "[DomainHealth]: Provider notification failed"),
  );
}

export const DomainHealthService = {
  async checkAll() {
    const domains = await db.domain.findMany({
      where: { status: DomainStatus.SUCCESS, team: { isBlocked: false } },
      select: {
        id: true,
        name: true,
        teamId: true,
        subdomain: true,
        dkimSelector: true,
        publicKey: true,
        region: true,
        dnsIssues: true,
        dnsIssuesNotifiedAt: true,
      },
    });

    let broken = 0;
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      await Promise.all(
        domains.slice(i, i + BATCH_SIZE).map(async (domain) => {
          try {
            const issues = await checkDomainDnsHealth(domain);
            const transition = dnsHealthTransition({
              issues,
              previousIssues: Array.isArray(domain.dnsIssues) ? (domain.dnsIssues as string[]) : [],
              notified: Boolean(domain.dnsIssuesNotifiedAt),
            });
            const now = new Date();
            if (issues.length) broken++;

            switch (transition) {
              case "healthy":
                await db.domain.update({ where: { id: domain.id }, data: { dnsCheckedAt: now } });
                break;
              case "notify_fixed":
                await notifyTeam(domain, [], true);
                await db.domain.update({
                  where: { id: domain.id },
                  data: { dnsIssues: Prisma.DbNull, dnsIssuesSince: null, dnsIssuesNotifiedAt: null, dnsCheckedAt: now },
                });
                break;
              case "first_seen":
                await db.domain.update({
                  where: { id: domain.id },
                  data: { dnsIssues: issues, dnsIssuesSince: now, dnsCheckedAt: now },
                });
                break;
              case "notify_broken":
                await notifyTeam(domain, issues, false);
                await db.domain.update({
                  where: { id: domain.id },
                  data: { dnsIssues: issues, dnsIssuesNotifiedAt: now, dnsCheckedAt: now },
                });
                break;
              case "still_broken":
                await db.domain.update({ where: { id: domain.id }, data: { dnsIssues: issues, dnsCheckedAt: now } });
                break;
            }
          } catch (error) {
            logger.warn({ err: error, domainId: domain.id }, "[DomainHealth]: Check failed");
          }
        }),
      );
    }
    return { checked: domains.length, broken };
  },
};
