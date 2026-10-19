import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (str) => !str.includes("YOUR_MYSQL_URL_HERE"),
        "You forgot to change the default URL",
      ),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    AWS_ACCESS_KEY: z.string(),
    AWS_SECRET_KEY: z.string(),
    BYTESEND_API_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    AWS_SES_ENDPOINT: z.string().optional(),
    AWS_SNS_ENDPOINT: z.string().optional(),
    AWS_DEFAULT_REGION: z.string().default("us-east-1"),
    API_RATE_LIMIT: z
      .string()
      .default("1")
      .transform((str) => parseInt(str, 10)),
    AUTH_EMAIL_RATE_LIMIT: z
      .string()
      .default("0")
      .transform((str) => parseInt(str, 10)),
    FROM_EMAIL: z.string().optional(),
    ADMIN_EMAIL: z.string().optional(),
    FOUNDER_EMAIL: z.string().optional(),
    DISCORD_WEBHOOK_URL: z.string().optional(),
    ADMIN_DISCORD_WEBHOOK_URL: z.string().url().optional(),
    REDIS_URL: z.string(),
    SPAMHAUS_DQS_KEY: z.string().optional(),
    HEALTH_CHECK_TOKEN: z.string().min(16).optional(),
    PRISMA_LOG_QUERIES: z.enum(["true", "false"]).optional(),
    REDIS_KEY_PREFIX: z.string().default(""),
    S3_COMPATIBLE_ACCESS_KEY: z.string().optional(),
    S3_COMPATIBLE_SECRET_KEY: z.string().optional(),
    S3_COMPATIBLE_API_URL: z.string().optional(),
    S3_COMPATIBLE_PUBLIC_URL: z.string().optional(),
    S3_COMPATIBLE_BUCKET: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SMTP_HOST: z.string().default("smtp.bytesend.cloud"),
    SMTP_USER: z.string().default("bytesend"),
    CONTACT_BOOK_ID: z.string().optional(),
    EMAIL_CLEANUP_DAYS: z
      .string()
      .optional()
      .transform((str) => (str ? parseInt(str, 10) : undefined)),
    GITHUB_RELEASE_TOKEN: z.string().optional(),
    GITLAB_URL: z.string().url().optional(),
    GITLAB_REPO_ID: z.string().optional(),
    GITLAB_RELEASE_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_IS_CLOUD: z
      .string()
      .default("false")
      .transform((str) => str === "true"),
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
    NEXT_PUBLIC_GIT_SHA: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
    AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
    BYTESEND_API_KEY: process.env.BYTESEND_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
    AWS_SES_ENDPOINT: process.env.AWS_SES_ENDPOINT,
    AWS_SNS_ENDPOINT: process.env.AWS_SNS_ENDPOINT,
    API_RATE_LIMIT: process.env.API_RATE_LIMIT,
    AUTH_EMAIL_RATE_LIMIT: process.env.AUTH_EMAIL_RATE_LIMIT,
    NEXT_PUBLIC_IS_CLOUD: process.env.NEXT_PUBLIC_IS_CLOUD,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    FOUNDER_EMAIL: process.env.FOUNDER_EMAIL,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    ADMIN_DISCORD_WEBHOOK_URL: process.env.ADMIN_DISCORD_WEBHOOK_URL,
    REDIS_URL: process.env.REDIS_URL,
    SPAMHAUS_DQS_KEY: process.env.SPAMHAUS_DQS_KEY,
    HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN,
    PRISMA_LOG_QUERIES: process.env.PRISMA_LOG_QUERIES,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    FROM_EMAIL: process.env.FROM_EMAIL,
    S3_COMPATIBLE_ACCESS_KEY: process.env.S3_COMPATIBLE_ACCESS_KEY,
    S3_COMPATIBLE_SECRET_KEY: process.env.S3_COMPATIBLE_SECRET_KEY,
    S3_COMPATIBLE_API_URL: process.env.S3_COMPATIBLE_API_URL,
    S3_COMPATIBLE_PUBLIC_URL: process.env.S3_COMPATIBLE_PUBLIC_URL,
    S3_COMPATIBLE_BUCKET: process.env.S3_COMPATIBLE_BUCKET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    CONTACT_BOOK_ID: process.env.CONTACT_BOOK_ID,
    EMAIL_CLEANUP_DAYS: process.env.EMAIL_CLEANUP_DAYS,
    GITHUB_RELEASE_TOKEN: process.env.GITHUB_RELEASE_TOKEN,
    GITLAB_URL: process.env.GITLAB_URL,
    GITLAB_REPO_ID: process.env.GITLAB_REPO_ID,
    GITLAB_RELEASE_TOKEN: process.env.GITLAB_RELEASE_TOKEN,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
