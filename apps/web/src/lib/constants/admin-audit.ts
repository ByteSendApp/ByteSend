export const ADMIN_AUDIT_ACTIONS = {
  "ses.create": "Added SES region",
  "ses.update": "Updated SES region",
  "ses.delete": "Deleted SES region",
  "ses.toggle": "Toggled SES region",
  "ses.resubscribe": "Resubscribed SES callback",
  "user.beta.update": "Changed beta access",
  "user.admin.update": "Changed admin role",
  "user.ban": "Banned user",
  "user.unban": "Unbanned user",
  "team.settings.update": "Updated team settings",
  "team.plan.assign": "Assigned plan",
  "team.plan.checkout_link": "Created checkout link",
  "team.block": "Blocked team",
  "team.unblock": "Unblocked team",
  "team.delete": "Deleted team",
  "domain.force_verify": "Force-verified domain",
  "domain.delete": "Deleted domain",
  "domain.blacklist_recheck": "Re-checked blacklists",
  "domain.region_move.start": "Started region move",
  "domain.region_move.cancel": "Cancelled region move",
  "email.view_content": "Viewed email content",
  "spam.release": "Released held message",
  "spam.reject": "Rejected held message",
} as const;

export type AdminAuditAction = keyof typeof ADMIN_AUDIT_ACTIONS;

export const ADMIN_AUDIT_TARGET_TYPES = ["ses", "user", "team", "domain", "email"] as const;

export type AdminAuditTargetType = (typeof ADMIN_AUDIT_TARGET_TYPES)[number];

export function adminAuditActionLabel(action: string) {
  return ADMIN_AUDIT_ACTIONS[action as AdminAuditAction] ?? action;
}
