import Link from "next/link";
import { FaDiscord } from "react-icons/fa6";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { AuthShell } from "~/components/auth/auth-shell";

export default function BannedPage() {
  return (
    <AuthShell
      aside={false}
      title="Your account is suspended"
      description="You can't sign in or send email from ByteSend while it's suspended."
    >
      <Callout tone="danger" title="Why this happens">
        Accounts are suspended when they break the <Link href="/acceptable-use">Acceptable Use Policy</Link>, for example by sending
        spam or phishing. If you think we got it wrong, appeal and a person will review it.
      </Callout>
      <div className="grid gap-2">
        <Button asChild className="h-10 w-full">
          <a href="https://discord.gg/C2Q4GHXKQA" target="_blank" rel="noopener noreferrer">
            <FaDiscord className="size-4" />
            Appeal on Discord
          </a>
        </Button>
        <Button asChild variant="outline" className="h-10 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
