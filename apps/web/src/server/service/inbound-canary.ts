import { env } from "~/env";
import { logger } from "../logger/log";
import { getRedis, redisKey } from "../redis";

export const INBOUND_CANARY_INTERVAL_MS = 10 * 60 * 1000;
export const INBOUND_CANARY_SLUG = "status-canary";
const FIRST_SENT_KEY = "inbound:canary:first-sent";
const LAST_SENT_KEY = "inbound:canary:last-sent";
const LAST_SEEN_KEY = "inbound:canary:last-seen";

export function inboundCanaryAddress() {
  return env.INBOUND_HOSTED_DOMAIN ? `${INBOUND_CANARY_SLUG}@${env.INBOUND_HOSTED_DOMAIN.toLowerCase()}` : null;
}

export function isInboundCanary(address: string) {
  const canary = inboundCanaryAddress();
  return canary !== null && address.trim().toLowerCase() === canary;
}

export async function recordInboundCanary() {
  await getRedis().set(redisKey(LAST_SEEN_KEY), String(Date.now()));
}

export async function sendInboundCanary() {
  const address = inboundCanaryAddress();
  if (!address) return;
  const { sendMail } = await import("../mailer");
  const sentAt = new Date().toISOString();
  await sendMail(
    address,
    `ByteSend receiving check ${sentAt}`,
    `Automated receiving check sent at ${sentAt}.`,
    `<p>Automated receiving check sent at ${sentAt}.</p>`,
  );
  const now = String(Date.now());
  await getRedis().set(redisKey(FIRST_SENT_KEY), now, "NX");
  await getRedis().set(redisKey(LAST_SENT_KEY), now);
  logger.info({ address }, "[InboundCanary]: Sent");
}

export async function sendInboundCanaryIfDue() {
  const claimed = await getRedis().set(redisKey("inbound:canary:lock"), String(Date.now()), "PX", INBOUND_CANARY_INTERVAL_MS - 30_000, "NX");
  if (claimed) await sendInboundCanary();
}

export async function getInboundCanaryTimes() {
  const [first, sent, seen] = await getRedis().mget(redisKey(FIRST_SENT_KEY), redisKey(LAST_SENT_KEY), redisKey(LAST_SEEN_KEY));
  return {
    firstSentAt: first ? Number(first) : null,
    lastSentAt: sent ? Number(sent) : null,
    lastSeenAt: seen ? Number(seen) : null,
  };
}
