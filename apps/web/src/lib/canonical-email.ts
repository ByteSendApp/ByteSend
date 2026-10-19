const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Reduces an address to the mailbox it actually delivers to, so aliases of a banned address match:
 * lowercased, "+tag" removed, and for Gmail the dots in the local part dropped and googlemail.com
 * folded into gmail.com. The migration that backfills banned users mirrors these rules in SQL.
 */
export function canonicalEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  local = local.split("+")[0] ?? local;
  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).trim().toLowerCase() || null;
}

/** "a.b.example.com" → ["a.b.example.com", "b.example.com", "example.com"] */
export function domainAndParents(domain: string): string[] {
  const labels = domain.trim().toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    candidates.push(labels.slice(i).join("."));
  }
  return candidates;
}
