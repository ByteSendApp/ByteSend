import { DomainStatus, type Domain } from "@prisma/client";
import * as ses from "~/server/aws/ses";
import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { ByteSendApiError } from "../public-api/api-error";
import type { DomainDnsRecord } from "~/types/domain";
import { SesSettingsService } from "./ses-settings-service";
import { env } from "~/env";
import { receivesThroughKeptIdentity } from "./inbound-domain-service";
import {
  checkDkimDnsRecord,
  checkMxDnsRecord,
  emitDomainEvent,
  parseDomainStatus,
  type DnsCheckResult,
} from "./domain-service";

// The old identity outlives the switch so sends that were already in flight still have a signer.
export const RETIRE_OLD_REGION_AFTER_MS = 24 * 60 * 60 * 1000;

const CLEARED_PENDING_FIELDS = {
  pendingRegion: null,
  pendingDkimSelector: null,
  pendingPublicKey: null,
  pendingDkimStatus: null,
  pendingMailFromStatus: null,
  regionMoveStartedAt: null,
} as const;

export function regionMoveSelector(region: string) {
  return `bytesend-${region}`;
}

function mailDomainLabel(domain: Pick<Domain, "subdomain">) {
  return `mail${domain.subdomain ? `.${domain.subdomain}` : ""}`;
}

export function buildRegionMoveRecords(domain: Domain): DomainDnsRecord[] | null {
  if (!domain.pendingRegion || !domain.pendingDkimSelector || !domain.pendingPublicKey) return null;
  const subdomainSuffix = domain.subdomain ? `.${domain.subdomain}` : "";

  return [
    {
      type: "TXT",
      name: `${domain.pendingDkimSelector}._domainkey${subdomainSuffix}`,
      value: `p=${domain.pendingPublicKey}`,
      ttl: "Auto",
      status: parseDomainStatus(domain.pendingDkimStatus),
    },
    {
      type: "MX",
      name: mailDomainLabel(domain),
      value: `feedback-smtp.${domain.pendingRegion}.amazonses.com`,
      ttl: "Auto",
      priority: "10",
      status: parseDomainStatus(domain.pendingMailFromStatus),
    },
  ];
}

export function getRegionMoveSummary(domain: Domain) {
  const records = buildRegionMoveRecords(domain);
  if (!records || !domain.pendingRegion) return null;
  return {
    fromRegion: domain.region,
    toRegion: domain.pendingRegion,
    startedAt: domain.regionMoveStartedAt,
    records,
  };
}

export class DomainRegionService {
  static async start(domain: Domain, targetRegion: string) {
    if (domain.pendingRegion) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "A region move is already in progress" });
    }
    if (domain.retiredRegion) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: `The previous region (${domain.retiredRegion}) is still being retired. Try again in a day.`,
      });
    }
    if (domain.status !== DomainStatus.SUCCESS) {
      throw new ByteSendApiError({
        code: "BAD_REQUEST",
        message: "Only verified domains can change region. Delete and re-add an unverified domain instead.",
      });
    }
    if (targetRegion === domain.region) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "The domain already sends from that region" });
    }

    const setting = await SesSettingsService.getSetting(targetRegion);
    if (!setting?.isActive) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "That region is not available" });
    }

    const selector = regionMoveSelector(targetRegion);
    const publicKey = await ses.addDomain(domain.name, targetRegion, domain.sesTenantId ?? undefined, selector);

    const updated = await db.domain.update({
      where: { id: domain.id },
      data: {
        pendingRegion: targetRegion,
        pendingDkimSelector: selector,
        pendingPublicKey: publicKey,
        pendingDkimStatus: DomainStatus.NOT_STARTED,
        pendingMailFromStatus: DomainStatus.NOT_STARTED,
        regionMoveStartedAt: new Date(),
      },
    });

    logger.info(
      { domainId: domain.id, from: domain.region, to: targetRegion },
      "[DomainRegionService]: Region move started",
    );
    return updated;
  }

  static async cancel(domain: Domain) {
    if (!domain.pendingRegion) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "No region move in progress" });
    }

    try {
      await ses.deleteDomain(domain.name, domain.pendingRegion, domain.sesTenantId ?? undefined);
    } catch (error) {
      logger.error(
        { err: error, domainId: domain.id, region: domain.pendingRegion },
        "[DomainRegionService]: Failed to delete pending identity while cancelling",
      );
    }

    return db.domain.update({ where: { id: domain.id }, data: CLEARED_PENDING_FIELDS });
  }

  static async refresh(domain: Domain) {
    if (!domain.pendingRegion || !domain.pendingDkimSelector || !domain.pendingPublicKey) {
      return { domain, switched: false, dnsPrecheck: null };
    }

    const [identity, dkimDns, mxDns] = await Promise.all([
      ses.getDomainIdentity(domain.name, domain.pendingRegion),
      checkDkimDnsRecord(domain.pendingDkimSelector, domain.name, domain.pendingPublicKey),
      checkMxDnsRecord(`${mailDomainLabel(domain)}.${domain.name}`, domain.pendingRegion),
    ]);
    const dnsPrecheck: { dkim: DnsCheckResult; mx: DnsCheckResult } = { dkim: dkimDns, mx: mxDns };

    const dkimStatus = parseDomainStatus(identity.DkimAttributes?.Status?.toString());
    const sesMailFromStatus = parseDomainStatus(identity.MailFromAttributes?.MailFromDomainStatus?.toString());
    const mailFromStatus =
      sesMailFromStatus === DomainStatus.SUCCESS && mxDns !== "found" ? DomainStatus.PENDING : sesMailFromStatus;
    const identityVerified = parseDomainStatus(identity.VerificationStatus?.toString()) === DomainStatus.SUCCESS;

    if (identityVerified && dkimStatus === DomainStatus.SUCCESS && mailFromStatus === DomainStatus.SUCCESS) {
      const switched = await DomainRegionService.switchOver(domain, dkimStatus, mailFromStatus);
      return { domain: switched, switched: true, dnsPrecheck };
    }

    const updated = await db.domain.update({
      where: { id: domain.id },
      data: { pendingDkimStatus: dkimStatus, pendingMailFromStatus: mailFromStatus },
    });
    return { domain: updated, switched: false, dnsPrecheck };
  }

  private static async switchOver(domain: Domain, dkimStatus: DomainStatus, mailFromStatus: DomainStatus) {
    const updated = await db.domain.update({
      where: { id: domain.id },
      data: {
        region: domain.pendingRegion!,
        dkimSelector: domain.pendingDkimSelector,
        publicKey: domain.pendingPublicKey!,
        dkimStatus,
        spfDetails: mailFromStatus,
        status: DomainStatus.SUCCESS,
        errorMessage: null,
        retiredRegion: domain.region,
        retiredRegionAt: new Date(),
        ...CLEARED_PENDING_FIELDS,
      },
    });

    logger.info(
      { domainId: domain.id, from: domain.region, to: updated.region },
      "[DomainRegionService]: Region move completed",
    );
    await emitDomainEvent(updated, "domain.updated");
    return updated;
  }

  static async retireOldRegionIfDue(domain: Domain, now = Date.now()) {
    if (!domain.retiredRegion || !domain.retiredRegionAt) return false;
    if (now - domain.retiredRegionAt.getTime() < RETIRE_OLD_REGION_AFTER_MS) return false;

    const keepForReceiving = domain.retiredRegion === env.INBOUND_REGION && receivesThroughKeptIdentity(domain);
    if (keepForReceiving) {
      logger.info({ domainId: domain.id, region: domain.retiredRegion }, "[DomainRegionService]: Kept the old identity because the domain receives mail through it");
    }

    if (domain.retiredRegion !== domain.region && !keepForReceiving) {
      try {
        await ses.deleteDomain(domain.name, domain.retiredRegion, domain.sesTenantId ?? undefined);
      } catch (error) {
        if ((error as { name?: string })?.name !== "NotFoundException") {
          logger.error(
            { err: error, domainId: domain.id, region: domain.retiredRegion },
            "[DomainRegionService]: Failed to delete retired identity; will retry",
          );
          return false;
        }
      }
    }

    await db.domain.update({
      where: { id: domain.id },
      data: { retiredRegion: null, retiredRegionAt: null },
    });
    return true;
  }
}
