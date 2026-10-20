"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import EmailList from "./email-list";

export default function EmailsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Emails" description="Every email your team has sent, with its latest delivery status." />
      <EmailList />
    </div>
  );
}
