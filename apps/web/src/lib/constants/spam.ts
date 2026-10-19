export const SPAM_FLAG_SCORE = 5;
export const SPAM_HOLD_SCORE = 10;
export const SPAM_AUTO_BLOCK_HOLDS = 5;
export const SPAM_AUTO_BLOCK_WINDOW_HOURS = 24;

export const SPAM_RULE_LABELS: Record<string, string> = {
  phishing_phrase: "Phishing phrase",
  brand_impersonation: "Brand impersonation in sender name",
  link_text_mismatch: "Link text shows a different domain",
  ip_link: "Link to a raw IP address",
  url_shortener: "URL shortener link",
  punycode_link: "Punycode (look-alike) link",
  dangerous_link_scheme: "javascript:/data: link",
  dangerous_attachment: "Executable or macro attachment",
  spam_phrase: "Spammy phrase",
  shouting_subject: "ALL-CAPS subject",
  excessive_punctuation: "Excessive !!! or $$$",
  image_only: "Image-only body",
  hidden_text: "Hidden text",
  blacklisted_link: "Link domain on a blocklist",
  new_team: "Team created in the last 7 days",
};
