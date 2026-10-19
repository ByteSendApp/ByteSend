-- CreateEnum
CREATE TYPE "BlocklistType" AS ENUM ('EMAIL', 'EMAIL_DOMAIN', 'SENDING_DOMAIN');

-- CreateTable
CREATE TABLE "BlocklistEntry" (
    "id" TEXT NOT NULL,
    "type" "BlocklistType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "sourceUserId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlocklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlocklistEntry_type_value_key" ON "BlocklistEntry"("type", "value");

-- CreateIndex
CREATE INDEX "BlocklistEntry_sourceUserId_idx" ON "BlocklistEntry"("sourceUserId");

-- Backfill: block the canonical email of every user banned before the blocklist existed.
-- Mirrors canonicalEmail() in src/lib/canonical-email.ts.
WITH banned AS (
    SELECT "id", lower(trim("email")) AS email
    FROM "User"
    WHERE "isBanned" = true AND "email" IS NOT NULL AND position('@' in "email") > 1
),
parts AS (
    SELECT
        "id",
        split_part(split_part(email, '@', 1), '+', 1) AS local,
        CASE WHEN split_part(email, '@', 2) = 'googlemail.com' THEN 'gmail.com' ELSE split_part(email, '@', 2) END AS domain
    FROM banned
)
INSERT INTO "BlocklistEntry" ("id", "type", "value", "reason", "sourceUserId")
SELECT
    'bl' || md5(random()::text || clock_timestamp()::text),
    'EMAIL',
    CASE WHEN domain = 'gmail.com' THEN replace(local, '.', '') ELSE local END || '@' || domain,
    'Banned user',
    "id"
FROM parts
ON CONFLICT ("type", "value") DO NOTHING;
