import { parse } from "tldts";
import { domainAndParents } from "../canonical-email";

/**
 * Services that hand anyone a hostname under their own domain: dynamic DNS, free subdomains,
 * tunnels and app-hosting platforms. A customer never owns DNS for these, so nothing legitimate
 * sends from them, and they're a staple of throwaway phishing setups.
 *
 * Deliberately a curated list rather than the Public Suffix List's whole "private" section: that
 * section also contains paid registration namespaces (uk.com, us.com, co.nl, com.de, eu.org, ...)
 * where people own real domains. Those are only flagged for review (see isPrivateSuffixHostname).
 */
export const SHARED_HOSTNAME_DOMAINS = new Set([
  // DynDNS
  "dyndns.org", "dyndns.biz", "dyndns.info", "dyndns.tv", "dyndns.ws", "dyndns-at-home.com",
  "homelinux.org", "homelinux.com", "homelinux.net", "homelinuxserver.org",
  "homeunix.org", "homeunix.com", "homeunix.net", "homeip.net",
  "dnsalias.org", "dnsalias.com", "dnsalias.net", "dynalias.org", "dynalias.com", "dynalias.net",
  "gotdns.org", "gotdns.com", "selfip.org", "selfip.com", "selfip.net", "selfip.info", "selfip.biz",
  "blogdns.org", "blogdns.com", "blogdns.net", "is-a-geek.org", "is-a-geek.com", "is-a-geek.net",
  "kicks-ass.org", "kicks-ass.net", "mine.nu", "ath.cx", "game-host.org", "game-server.cc",
  "servebbs.org", "servebbs.net", "servebbs.com", "serveftp.org", "serveftp.net",
  "webhop.org", "webhop.net", "webhop.info", "webhop.biz", "scrapping.cc", "podzone.org", "podzone.net",
  // No-IP
  "no-ip.com", "no-ip.org", "no-ip.biz", "no-ip.info", "noip.me", "ddns.net", "hopto.org", "zapto.org",
  "sytes.net", "serveblog.net", "servehttp.com", "myftp.org", "myftp.biz", "redirectme.net",
  "servegame.com", "bounceme.net", "myvnc.com", "servequake.com", "serveminecraft.net",
  // FreeDNS (afraid.org)
  "mooo.com", "chickenkiller.com", "us.to", "uk.to", "strangled.net", "crabdance.com", "ignorelist.com",
  "jumpingcrab.com", "twilightparadox.com", "afraid.org",
  // Dynu, ChangeIP and other dynamic DNS
  "dynu.net", "ddnsfree.com", "freeddns.org", "accesscam.org", "changeip.com", "changeip.net",
  "ydns.eu", "dedyn.io", "nsupdate.info", "freemyip.com", "duckdns.org", "dynv6.net",
  // Tunnels
  "ngrok.io", "ngrok-free.app", "ngrok.app", "trycloudflare.com", "localhost.run", "serveo.net",
  "loca.lt", "pagekite.me",
  // App and site hosting platforms
  "github.io", "gitlab.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "herokuapp.com",
  "firebaseapp.com", "web.app", "onrender.com", "fly.dev", "railway.app", "up.railway.app", "glitch.me",
  "repl.co", "replit.app", "surge.sh", "azurewebsites.net", "cloudfront.net", "blogspot.com",
  "wixsite.com", "weebly.com", "myshopify.com", "000webhostapp.com",
]);

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\.$/, "");
}

/** True when `name` is a hostname on a shared service from the curated list. Safe to hard-block. */
export function isSharedHostname(name: string): boolean {
  return domainAndParents(normalize(name)).some((candidate) => SHARED_HOSTNAME_DOMAINS.has(candidate));
}

/**
 * True when the Public Suffix List puts `name` under someone else's namespace. Covers shared
 * services missing from the curated list but also legitimate paid namespaces, so only use it to
 * flag a domain for review, never to block it.
 */
export function isPrivateSuffixHostname(name: string): boolean {
  return Boolean(parse(normalize(name), { allowPrivateDomains: true }).isPrivate);
}
