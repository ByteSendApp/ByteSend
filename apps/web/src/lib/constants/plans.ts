import { Plan } from "@prisma/client";
import { PLANS } from "@bytesend/lib";

export enum LimitReason {
  DOMAIN = "DOMAIN",
  CONTACT_BOOK = "CONTACT_BOOK",
  CONTACTS = "CONTACTS",
  CAMPAIGN = "CAMPAIGN",
  TEAM_MEMBER = "TEAM_MEMBER",
  WEBHOOK = "WEBHOOK",
  EMAIL_BLOCKED = "EMAIL_BLOCKED",
  EMAIL_DAILY_LIMIT_REACHED = "EMAIL_DAILY_LIMIT_REACHED",
  EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED = "EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED",
  MARKETING_NOT_AVAILABLE = "MARKETING_NOT_AVAILABLE",
  BOUNCE_RATE_EXCEEDED = "BOUNCE_RATE_EXCEEDED",
  COMPLAINT_RATE_EXCEEDED = "COMPLAINT_RATE_EXCEEDED",
}

export const PLAN_LIMITS: Record<
  Plan,
  {
    emailsPerMonth: number;
    emailsPerDay: number;
    domains: number;
    contactBooks: number;
    contacts: number;
    teamMembers: number;
    webhooks: number;
    campaigns: number;
    marketingEmailsIncluded: boolean;
  }
> = {
  FREE: {
    emailsPerMonth: PLANS.FREE.limits.monthlyEmailLimit,
    emailsPerDay: PLANS.FREE.limits.dailyEmailLimit,
    domains: PLANS.FREE.limits.maxDomains,
    contactBooks: PLANS.FREE.limits.maxContactBooks,
    contacts: PLANS.FREE.limits.contactsLimit,
    campaigns: PLANS.FREE.limits.campaignsLimit,
    teamMembers: PLANS.FREE.limits.maxTeamMembers,
    webhooks: PLANS.FREE.limits.maxWebhooks,
    marketingEmailsIncluded: PLANS.FREE.limits.marketingEmailsIncluded,
  },
  HOBBY: {
    emailsPerMonth: PLANS.HOBBY.limits.monthlyEmailLimit,
    emailsPerDay: -1,
    domains: PLANS.HOBBY.limits.maxDomains,
    contactBooks: PLANS.HOBBY.limits.maxContactBooks,
    contacts: PLANS.HOBBY.limits.contactsLimit,
    campaigns: PLANS.HOBBY.limits.campaignsLimit,
    teamMembers: PLANS.HOBBY.limits.maxTeamMembers,
    webhooks: PLANS.HOBBY.limits.maxWebhooks,
    marketingEmailsIncluded: PLANS.HOBBY.limits.marketingEmailsIncluded,
  },
  LITE: {
    emailsPerMonth: PLANS.LITE.limits.monthlyEmailLimit,
    emailsPerDay: -1,
    domains: PLANS.LITE.limits.maxDomains,
    contactBooks: PLANS.LITE.limits.maxContactBooks,
    contacts: PLANS.LITE.limits.contactsLimit,
    campaigns: PLANS.LITE.limits.campaignsLimit,
    teamMembers: PLANS.LITE.limits.maxTeamMembers,
    webhooks: PLANS.LITE.limits.maxWebhooks,
    marketingEmailsIncluded: PLANS.LITE.limits.marketingEmailsIncluded,
  },
  BASIC: {
    emailsPerMonth: PLANS.BASIC.limits.monthlyEmailLimit,
    emailsPerDay: -1,
    domains: PLANS.BASIC.limits.maxDomains,
    contactBooks: PLANS.BASIC.limits.maxContactBooks,
    contacts: -1,
    campaigns: PLANS.BASIC.limits.campaignsLimit,
    teamMembers: -1,
    webhooks: PLANS.BASIC.limits.maxWebhooks,
    marketingEmailsIncluded: PLANS.BASIC.limits.marketingEmailsIncluded,
  },
  LIFETIME: {
    emailsPerMonth: -1,
    emailsPerDay: -1,
    domains: PLANS.LIFETIME.limits.maxDomains,
    contactBooks: PLANS.LIFETIME.limits.maxContactBooks,
    contacts: -1,
    campaigns: PLANS.LIFETIME.limits.campaignsLimit,
    teamMembers: -1,
    webhooks: PLANS.LIFETIME.limits.maxWebhooks,
    marketingEmailsIncluded: PLANS.LIFETIME.limits.marketingEmailsIncluded,
  },
};
