import { NextResponse } from "next/server";
import { env } from "~/env";
import { logger } from "~/server/logger/log";

const GITHUB_REPOS = ["ByteSendApp/ByteSend"];
const FALLBACK_VERSION = "canary";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FALLBACK_TTL_MS = 60 * 1000;

// Without a token GitHub allows 60 requests/hour per IP, so lookups are cached per server process.
let cached: { version: string; expiresAt: number } | null = null;
let lastKnownVersion: string | null = null;

// Injected at build time by CI (e.g. NEXT_PUBLIC_APP_VERSION=v0.2.0).
// Highest priority: no network call needed.
// Treat absent / sentinel values as unset so we fall through to the API lookup.
const _buildVersion = process.env.NEXT_PUBLIC_APP_VERSION;
const BUILD_VERSION =
  _buildVersion && _buildVersion !== "unknown" && _buildVersion !== "canary"
    ? _buildVersion
    : null;

// Force dynamic so this isn't frozen as a static response at build time
export const dynamic = "force-dynamic";

/** Tries GitLab: permalink/latest first, then releases list, then tags. */
async function fetchFromGitLab(): Promise<string | null> {
  const base = env.GITLAB_URL;
  const repoId = env.GITLAB_REPO_ID;
  if (!base || !repoId) return null;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.GITLAB_RELEASE_TOKEN) {
    headers["PRIVATE-TOKEN"] = env.GITLAB_RELEASE_TOKEN;
  }

  const encodedId = encodeURIComponent(repoId);

  // 1. permalink/latest (GitLab 14.2+)
  try {
    const res = await fetch(
      `${base}/api/v4/projects/${encodedId}/releases/permalink/latest`,
      { headers, cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { tag_name?: string };
      if (data.tag_name) return data.tag_name;
    }
  } catch (err) {
    logger.warn({ err }, "[version] GitLab permalink/latest failed");
  }

  // 2. releases list (works on older GitLab)
  try {
    const res = await fetch(
      `${base}/api/v4/projects/${encodedId}/releases?per_page=1&order_by=released_at&sort=desc`,
      { headers, cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { tag_name?: string }[];
      if (Array.isArray(data) && data[0]?.tag_name) return data[0].tag_name;
    }
  } catch (err) {
    logger.warn({ err }, "[version] GitLab releases list failed");
  }

  // 3. repository tags (last resort: any repo with tags)
  try {
    const res = await fetch(
      `${base}/api/v4/projects/${encodedId}/repository/tags?per_page=1&order_by=updated&sort=desc`,
      { headers, cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { name?: string }[];
      if (Array.isArray(data) && data[0]?.name) return data[0].name;
    }
  } catch (err) {
    logger.warn({ err }, "[version] GitLab tags failed");
  }

  return null;
}

/** Tries GitHub: releases/latest, then first release from list. Checks each repo in order. */
async function fetchFromGitHub(): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_RELEASE_TOKEN) {
    headers["Authorization"] = `Bearer ${env.GITHUB_RELEASE_TOKEN}`;
  }

  for (const repo of GITHUB_REPOS) {
    // 1. latest release
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        { headers, cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { tag_name?: string };
        if (data.tag_name) return data.tag_name;
      }
    } catch (err) {
      logger.warn({ err, repo }, "[version] GitHub releases/latest failed");
    }

    // 2. releases list (handles repos where latest returns 404)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/releases?per_page=1`,
        { headers, cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { tag_name?: string }[];
        if (Array.isArray(data) && data[0]?.tag_name) return data[0].tag_name;
      }
    } catch (err) {
      logger.warn({ err, repo }, "[version] GitHub releases list failed");
    }

    // 3. tags (catches repos that use tags but not formal releases)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/tags?per_page=1`,
        { headers, cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { name?: string }[];
        if (Array.isArray(data) && data[0]?.name) return data[0].name;
      }
    } catch (err) {
      logger.warn({ err, repo }, "[version] GitHub tags failed");
    }
  }

  return null;
}

export async function GET() {
  // 1. Build-time injection (CI sets NEXT_PUBLIC_APP_VERSION before `next build`)
  if (BUILD_VERSION) {
    return NextResponse.json({ version: BUILD_VERSION });
  }

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ version: cached.version });
  }

  // 2. Runtime: GitLab → GitHub → last known → canary
  const fetched = (await fetchFromGitLab()) ?? (await fetchFromGitHub());
  if (fetched) lastKnownVersion = fetched;
  const version = fetched ?? lastKnownVersion ?? FALLBACK_VERSION;
  cached = { version, expiresAt: Date.now() + (fetched ? CACHE_TTL_MS : FALLBACK_TTL_MS) };

  return NextResponse.json({ version });
}

