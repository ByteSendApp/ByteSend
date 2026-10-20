import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { Panel } from "@bytesend/ui/src/panel";

export default function DashboardNotFound() {
  return (
    <Panel flush className="mt-4">
      <EmptyState
        className="py-20"
        icon={<SearchX />}
        title="We couldn't find that"
        description="It may have been deleted, or it belongs to a different team. Check you're in the right team using the switcher at the top left."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Back to the overview</Link>
          </Button>
        }
      />
    </Panel>
  );
}
