import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "~/env";

// Force server-render on every request so the page isn't baked at build time
// (env vars like GITLAB_URL are only available at runtime, not during `next build`).
// The individual fetch() calls below still use next: { revalidate: 3600 } for
// data-level caching, so we don't hammer the API on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Changelog – ByteSend",
  description: "New features, improvements, and fixes shipping in every ByteSend release.",
  alternates: { canonical: "https://bytesend.cloud/changelog" },
};

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

type Release = {
  tag: string;
  name: string;
  date: string;
  body: string;
  url: string;
};

/* ─────────────────────────────────────────────────────────────
   Data fetching: GitLab (custom instance) → GitHub (private)
───────────────────────────────────────────────────────────── */

const GITHUB_REPO = "ByteSendApp/ByteSend";

async function fetchFromGitLab(): Promise<Release[] | null> {
  const base = process.env.GITLAB_URL;
  const repoId = process.env.GITLAB_REPO_ID;
  if (!base || !repoId) return null;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.GITLAB_RELEASE_TOKEN) {
    headers["PRIVATE-TOKEN"] = process.env.GITLAB_RELEASE_TOKEN;
  }

  try {
    const res = await fetch(
      `${base}/api/v4/projects/${encodeURIComponent(repoId)}/releases?per_page=20&order_by=released_at&sort=desc`,
      { headers, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name: string;
      name: string;
      released_at: string;
      description: string;
      _links?: { self?: string };
    }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return data.map((r) => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      date: new Date(r.released_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      body: r.description ?? "",
      url: r._links?.self ?? "",
    }));
  } catch (err) {
    console.error("[changelog] GitLab fetch failed:", err);
    return null;
  }
}

async function fetchFromGitHub(): Promise<Release[] | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_RELEASE_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_RELEASE_TOKEN}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
      { headers, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name: string;
      name: string;
      published_at: string;
      body: string;
      html_url: string;
    }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return data.map((r) => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      date: new Date(r.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      body: r.body ?? "",
      url: r.html_url,
    }));
  } catch (err) {
    console.error("[changelog] GitHub fetch failed:", err);
    return null;
  }
}

async function getReleases(): Promise<Release[]> {
  return (await fetchFromGitLab()) ?? (await fetchFromGitHub()) ?? [];
}

/* ─────────────────────────────────────────────────────────────
   Inline markdown parser: **bold**, `code`, *italic*, [links](url)
───────────────────────────────────────────────────────────── */

function safeHref(url: string) {
  return /^(https?:\/\/|\/|#)/.test(url) ? url : null;
}

function parseInline(text: string): React.ReactNode {
  const INLINE = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;

  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      parts.push(<strong key={n++} className="font-semibold text-foreground">{parseInline(m[2])}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<code key={n++} className="font-mono text-[12px] bg-muted px-1 py-0.5 rounded">{m[3]}</code>);
    } else if (m[4] !== undefined) {
      const href = safeHref(m[5]!);
      const external = href?.startsWith("http") && !href.startsWith("https://bytesend.cloud");
      parts.push(
        href ? (
          <a
            key={n++}
            href={href}
            className="text-primary underline-offset-4 hover:underline"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {parseInline(m[4])}
          </a>
        ) : (
          <span key={n++}>{parseInline(m[4])}</span>
        ),
      );
    } else if (m[6] !== undefined) {
      parts.push(<em key={n++}>{parseInline(m[6])}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/* ─────────────────────────────────────────────────────────────
   Markdown body renderer: ## ### #### headings, bullets, blank
───────────────────────────────────────────────────────────── */

type BulletItem = { text: string; indent: number };

function ReleaseBody({ body }: { body: string }) {
  if (!body.trim()) return null;

  const lines = body.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: BulletItem[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={key++} className="space-y-2 mb-4">
        {listBuffer.map((item, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm text-foreground/80 leading-relaxed"
            style={{ paddingLeft: item.indent > 0 ? `${item.indent * 16}px` : undefined }}
          >
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-border shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{parseInline(item.text)}</span>
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trimStart();
    const indent = Math.floor((line.length - trimmed.length) / 2);

    if (trimmed.startsWith("#### ")) {
      flushList();
      nodes.push(
        <h5 key={key++} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-5 mb-1.5 first:mt-0">
          {parseInline(trimmed.slice(5))}
        </h5>,
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      nodes.push(
        <h4 key={key++} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-6 mb-2 first:mt-0">
          {parseInline(trimmed.slice(4))}
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      nodes.push(
        <h3 key={key++} className="text-sm font-semibold text-foreground mt-6 mb-2 first:mt-0">
          {parseInline(trimmed.slice(3))}
        </h3>,
      );
    } else if (/^[-*] /.test(trimmed)) {
      listBuffer.push({ text: trimmed.slice(2).trim(), indent });
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      nodes.push(
        <p key={key++} className="mb-2 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {parseInline(trimmed)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="mt-4">{nodes}</div>;
}

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */

export default async function ChangelogPage() {
  if (!env.NEXT_PUBLIC_IS_CLOUD) notFound();

  const releases = await getReleases();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-primary">Release notes</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Changelog</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            New features, improvements and fixes in every ByteSend release.{" "}
            <a href="https://github.com/ByteSendApp/ByteSend/releases" className="text-foreground underline-offset-4 hover:underline">
              Also on GitHub
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No releases found.</p>
        ) : (
          <div className="divide-y divide-border">
            {releases.map((release, idx) => (
              <article key={release.tag} id={release.tag} className="grid grid-cols-1 scroll-mt-20 gap-4 py-10 first:pt-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-10">
                <header className="md:sticky md:top-20 md:self-start">
                  <a href={`#${release.tag}`} className="group inline-flex items-center gap-2">
                    <h2 className="font-mono text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">{release.name}</h2>
                    {idx === 0 ? (
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Latest
                      </span>
                    ) : null}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">{release.date}</p>
                </header>
                <div className="min-w-0">
                  <ReleaseBody body={release.body} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
