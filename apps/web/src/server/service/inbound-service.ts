import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { Prisma, type InboundEmail } from "@prisma/client";
import { PLANS } from "@bytesend/lib";
import type { EmailReceivedPayload } from "@bytesend/lib/src/webhook/webhook-events";
import { env } from "~/env";
import { db } from "../db";
import { logger } from "../logger/log";
import { INBOUND_RAW_PREFIX } from "../aws/ses-receiving";
import { getInboundStore } from "./inbound-storage";
import { WebhookService } from "./webhook-service";
import { sendEmail } from "./email-service";
import { ingestDmarcMessage, isDmarcRecipient } from "./dmarc-service";
import { INBOUND_CANARY_SLUG, isInboundCanary, recordInboundCanary } from "./inbound-canary";

export const INBOUND_RETENTION_DAYS = 30;
const ATTACHMENT_LINK_TTL_SECONDS = 60 * 60;

export type SesInboundNotification = {
  notificationType: "Received";
  mail: { messageId: string; timestamp: string; source: string; destination: string[] };
  receipt: {
    recipients: string[];
    spamVerdict?: { status: string };
    virusVerdict?: { status: string };
    spfVerdict?: { status: string };
    dkimVerdict?: { status: string };
    dmarcVerdict?: { status: string };
    action: { type: "S3" | "SNS"; bucketName?: string; objectKey?: string; encoding?: "BASE64" | "UTF8" };
  };
  content?: string;
};

export type StoredAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  key: string;
  contentId?: string | null;
};

type RecipientMatch = { teamId: number; domainId: number | null; recipient: string };

const lower = (value: string) => value.trim().toLowerCase();

function addresses(field?: AddressObject | AddressObject[]) {
  return (Array.isArray(field) ? field : field ? [field] : []).flatMap((group) =>
    group.value.map((entry) => entry.address ?? "").filter(Boolean),
  );
}

function newId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export async function resolveRecipient(address: string): Promise<RecipientMatch | null> {
  const [rawLocal, rawDomain] = lower(address).split("@");
  if (!rawLocal || !rawDomain) return null;

  if (env.INBOUND_HOSTED_DOMAIN && rawDomain === lower(env.INBOUND_HOSTED_DOMAIN)) {
    const slug = rawLocal.split("+")[0]!;
    const team = await db.team.findUnique({ where: { inboundSlug: slug }, select: { id: true } });
    return team ? { teamId: team.id, domainId: null, recipient: lower(address) } : null;
  }

  const [subdomain, ...rest] = rawDomain.split(".");
  if (!subdomain || rest.length < 2) return null;
  const domain = await db.domain.findFirst({
    where: { name: rest.join("."), inboundEnabled: true, inboundSubdomain: subdomain },
    select: { id: true, teamId: true },
  });
  return domain ? { teamId: domain.teamId, domainId: domain.id, recipient: lower(address) } : null;
}

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getInboundUsage(teamId: number) {
  const [team, used] = await Promise.all([
    db.team.findUnique({ where: { id: teamId }, select: { plan: true } }),
    db.inboundEmail.count({ where: { teamId, receivedAt: { gte: startOfMonth() } } }),
  ]);
  const allowance = PLANS[team?.plan ?? "FREE"].limits.inboundEmailsPerMonth;
  return { used, allowance };
}

async function findRepliedTo(teamId: number, parsed: ParsedMail) {
  const refs = [parsed.inReplyTo ?? "", ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])]
    .join(" ")
    .match(/<([^@>\s]+)@[^>\s]*amazonses\.com>/g);
  if (!refs?.length) return null;
  const sesIds = refs.map((ref) => ref.slice(1, ref.indexOf("@")));
  const email = await db.email.findFirst({ where: { teamId, sesEmailId: { in: sesIds } }, select: { id: true } });
  return email?.id ?? null;
}


function signingSecret() {
  return env.NEXTAUTH_SECRET ?? "bytesend-local-inbound";
}

function signature(emailId: string, attachmentId: string, expires: number) {
  return createHmac("sha256", signingSecret()).update(`${emailId}.${attachmentId}.${expires}`).digest("hex");
}

export function attachmentUrl(emailId: string, attachmentId: string) {
  const expires = Math.floor(Date.now() / 1000) + ATTACHMENT_LINK_TTL_SECONDS;
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  return `${base}/api/inbound/attachments/${emailId}/${attachmentId}?expires=${expires}&sig=${signature(emailId, attachmentId, expires)}`;
}

export function verifyAttachmentSignature(emailId: string, attachmentId: string, expires: number, sig: string) {
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(emailId, attachmentId, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function attachmentsOf(email: Pick<InboundEmail, "attachments">) {
  return (email.attachments as unknown as StoredAttachment[]) ?? [];
}

export function toReceivedPayload(email: InboundEmail): EmailReceivedPayload {
  return {
    id: email.id,
    recipient: email.recipient,
    from: email.from,
    fromName: email.fromName,
    to: email.to,
    cc: email.cc,
    replyTo: email.replyTo,
    subject: email.subject,
    text: email.text,
    html: email.html,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    inReplyToEmailId: email.inReplyToEmailId,
    attachments: attachmentsOf(email).map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      url: attachmentUrl(email.id, a.id),
    })),
    authentication: { spf: email.spfVerdict, dkim: email.dkimVerdict, dmarc: email.dmarcVerdict, spam: email.spamVerdict, virus: email.virusVerdict },
    domainId: email.domainId,
    receivedAt: email.receivedAt.toISOString(),
  };
}

export function ruleMatches(match: string, recipient: string) {
  const rule = lower(match);
  if (rule === "*") return true;
  if (rule.includes("@")) return rule === recipient;
  return recipient.split("@")[0]!.split("+")[0] === rule;
}

async function forward(email: InboundEmail) {
  const rules = await db.inboundForwardRule.findMany({
    where: { teamId: email.teamId, enabled: true },
    select: { match: true, forwardTo: true },
  });
  const targets = [...new Set(rules.filter((rule) => ruleMatches(rule.match, email.recipient)).map((rule) => lower(rule.forwardTo)))];
  if (targets.length === 0) return;

  const domain = email.domainId
    ? await db.domain.findUnique({ where: { id: email.domainId }, select: { name: true, status: true } })
    : await db.domain.findFirst({ where: { teamId: email.teamId, status: "SUCCESS" }, select: { name: true, status: true } });

  if (!domain || domain.status !== "SUCCESS") {
    await db.inboundEmail.update({
      where: { id: email.id },
      data: { status: "FAILED", error: "Forwarding needs a verified sending domain on this team." },
    });
    return;
  }

  const store = getInboundStore();
  const attachments = await Promise.all(
    attachmentsOf(email).map(async (a) => ({ filename: a.filename, content: (await store.get(a.key)).toString("base64") })),
  );

  try {
    await sendEmail({
      teamId: email.teamId,
      from: `"${(email.fromName || email.from).replace(/"/g, "")} via ByteSend" <forwarding@${domain.name}>`,
      to: targets,
      replyTo: email.replyTo.length ? email.replyTo : [email.from],
      subject: email.subject,
      html: email.html ?? undefined,
      text: email.text ?? (email.html ? undefined : "(no content)"),
      attachments,
      headers: { "X-ByteSend-Forwarded-For": email.recipient },
    });
    await db.inboundEmail.update({ where: { id: email.id }, data: { status: "FORWARDED", forwardedTo: targets } });
  } catch (error) {
    logger.warn({ err: error, inboundEmailId: email.id }, "[Inbound]: Forwarding failed");
    await db.inboundEmail.update({
      where: { id: email.id },
      data: { status: "FAILED", error: `Forwarding failed: ${(error as Error).message}` },
    });
  }
}

async function loadRaw(notification: SesInboundNotification) {
  const store = getInboundStore();
  const { action } = notification.receipt;
  if (notification.content) {
    const raw = Buffer.from(notification.content, action.encoding === "BASE64" ? "base64" : "utf8");
    const key = `${INBOUND_RAW_PREFIX}${notification.mail.messageId}`;
    await store.put(key, raw, "message/rfc822");
    return { raw, key };
  }
  if (!action.objectKey) throw new Error("Received notification has neither content nor an S3 object");
  return { raw: await store.get(action.objectKey), key: action.objectKey };
}

export async function processInbound(notification: SesInboundNotification) {
  const sesId = notification.mail.messageId;

  const recipients = notification.receipt.recipients.filter((address) => !isInboundCanary(address));
  if (recipients.length < notification.receipt.recipients.length) {
    await recordInboundCanary();
    if (recipients.length === 0) {
      const { objectKey } = notification.receipt.action;
      if (objectKey) await getInboundStore().remove([objectKey]);
      return { stored: 0, reports: 0 };
    }
  }

  const matches = new Map<number, RecipientMatch>();
  for (const address of recipients) {
    const match = await resolveRecipient(address);
    if (match && !matches.has(match.teamId)) matches.set(match.teamId, match);
  }
  if (matches.size === 0) {
    logger.info({ sesId, recipients }, "[Inbound]: No team for these recipients, dropped");
    return { stored: 0, reports: 0 };
  }

  const { raw, key: rawKey } = await loadRaw(notification);
  const parsed = await simpleParser(raw);
  const store = getInboundStore();
  const verdict = (v?: { status: string }) => v?.status?.toLowerCase() ?? null;
  let stored = 0;
  let reports = 0;
  let rawInUse = false;

  for (const match of matches.values()) {
    if (isDmarcRecipient(match.recipient, match.domainId === null)) {
      reports += await ingestDmarcMessage(match.teamId, parsed, {
        spf: verdict(notification.receipt.spfVerdict),
        dkim: verdict(notification.receipt.dkimVerdict),
      });
      continue;
    }

    const uniqueId = `${sesId}:${match.teamId}`;
    if (await db.inboundEmail.findUnique({ where: { sesMessageId: uniqueId }, select: { id: true } })) {
      rawInUse = true;
      continue;
    }

    const { used, allowance } = await getInboundUsage(match.teamId);
    if (used >= allowance) {
      logger.warn({ teamId: match.teamId, used, allowance }, "[Inbound]: Monthly allowance reached, message dropped");
      continue;
    }

    const id = newId("inb");
    const attachments: StoredAttachment[] = [];
    for (const part of parsed.attachments) {
      const attachmentId = newId("att");
      const key = `attachments/${match.teamId}/${id}/${attachmentId}`;
      await store.put(key, part.content, part.contentType);
      attachments.push({
        id: attachmentId,
        filename: part.filename ?? "attachment",
        contentType: part.contentType,
        size: part.size,
        key,
        contentId: part.cid ?? null,
      });
    }

    const from = parsed.from?.value[0];
    const email = await db.inboundEmail.create({
      data: {
        id,
        teamId: match.teamId,
        domainId: match.domainId,
        sesMessageId: uniqueId,
        recipient: match.recipient,
        from: from?.address ?? notification.mail.source,
        fromName: from?.name || null,
        to: addresses(parsed.to),
        cc: addresses(parsed.cc),
        replyTo: addresses(parsed.replyTo),
        subject: parsed.subject ?? "",
        text: parsed.text ?? null,
        html: typeof parsed.html === "string" ? parsed.html : null,
        headers: parsed.headerLines.map((h) => ({ name: h.key, value: h.line.slice(h.key.length + 1).trim() })) as Prisma.InputJsonValue,
        messageId: parsed.messageId ?? null,
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
        inReplyToEmailId: await findRepliedTo(match.teamId, parsed),
        attachments: attachments as unknown as Prisma.InputJsonValue,
        size: raw.length,
        rawKey,
        spamVerdict: verdict(notification.receipt.spamVerdict),
        virusVerdict: verdict(notification.receipt.virusVerdict),
        spfVerdict: verdict(notification.receipt.spfVerdict),
        dkimVerdict: verdict(notification.receipt.dkimVerdict),
        dmarcVerdict: verdict(notification.receipt.dmarcVerdict),
        expiresAt: new Date(Date.now() + INBOUND_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    stored++;

    if (email.virusVerdict !== "fail") await forward(email);

    const latest = await db.inboundEmail.findUniqueOrThrow({ where: { id: email.id } });
    await WebhookService.emit(latest.teamId, "email.received", toReceivedPayload(latest), { domainId: latest.domainId });
  }

  if (!rawInUse && stored === 0) await store.remove([rawKey]);

  return { stored, reports };
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "team"
  );
}

export async function ensureInboundSlug(teamId: number) {
  const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true, inboundSlug: true } });
  if (team.inboundSlug) return team.inboundSlug;
  const slugified = slugify(team.name);
  const base = slugified === INBOUND_CANARY_SLUG ? `${slugified}-team` : slugified;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      await db.team.update({ where: { id: teamId }, data: { inboundSlug: slug } });
      return slug;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new Error("Couldn't pick a hosted inbound address");
}

export function hostedAddress(slug: string) {
  return env.INBOUND_HOSTED_DOMAIN ? `${slug}@${env.INBOUND_HOSTED_DOMAIN}` : null;
}

export async function deleteExpiredInbound(batchSize = 500) {
  let deleted = 0;
  for (; ;) {
    const expired = await db.inboundEmail.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, rawKey: true, attachments: true },
      take: batchSize,
    });
    if (expired.length === 0) break;
    const keys = expired.flatMap((email) => [...(email.rawKey ? [email.rawKey] : []), ...attachmentsOf(email).map((a) => a.key)]);
    await getInboundStore().remove(keys);
    await db.inboundEmail.deleteMany({ where: { id: { in: expired.map((email) => email.id) } } });
    deleted += expired.length;
    if (expired.length < batchSize) break;
  }
  return deleted;
}
