import type { Metadata } from "next";
import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import { computeLinkedRoleMetadata } from "~/server/service/discord-linked-roles-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discord roles – ByteSend",
  robots: { index: false },
};

const COPY = {
  linked: {
    title: "Your Discord roles are connected",
    body: "Head back to Discord, open the server menu → Linked Roles, and claim the roles you qualify for.",
  },
  cancelled: {
    title: "Connection cancelled",
    body: "Nothing was shared with Discord. You can connect again whenever you like.",
  },
  error: {
    title: "We couldn't connect your roles",
    body: "The link may have expired. Start again from Discord, or use /roles in the ByteSend server.",
  },
} as const;

type Status = keyof typeof COPY;

export default async function LinkedRolesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status: Status = rawStatus === "linked" || rawStatus === "cancelled" ? rawStatus : "error";
  const copy = COPY[status];

  const session = status === "linked" ? await getServerAuthSession() : null;
  const linked = session?.user ? await computeLinkedRoleMetadata(session.user.id) : null;

  return (
    <main className="min-h-[70vh] bg-background text-foreground">
      <div className="mx-auto max-w-xl px-6 py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "linked" ? "bg-[#00c3d6]" : "bg-muted-foreground"}`} />
          Discord linked roles
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-muted-foreground">{copy.body}</p>

        {linked && (
          <dl className="mt-8 divide-y divide-border/40 rounded-2xl border border-border/50 bg-muted/20">
            {[
              ["Shown on Discord as", linked.platformUsername],
              ["ByteSend user", "Yes"],
              ["Paid plan", linked.metadata.paid === "1" ? "Yes" : "No"],
              ["Emails sent", Number(linked.metadata.emails_sent).toLocaleString("en-GB")],
              [
                "Member since",
                new Date(linked.metadata.member_since).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          Roles reflect your account at the moment you connect. Upgraded or sent more since?{" "}
          <Link href="/api/discord/linked-roles" className="text-primary hover:underline">
            Connect again
          </Link>{" "}
          to refresh them.
        </p>
      </div>
    </main>
  );
}
