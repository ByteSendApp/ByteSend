import Link from "next/link";
import { Button } from "@bytesend/ui/src/button";
import { ErrorScreen } from "~/components/error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="This page doesn't exist"
      description="The link may be broken, or the page may have moved. Check the address, or head somewhere you know."
      actions={
        <>
          <Button asChild size="sm">
            <Link href="/dashboard">Go to the dashboard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/">Home page</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href="https://docs.bytesend.cloud">Docs</a>
          </Button>
        </>
      }
    />
  );
}
