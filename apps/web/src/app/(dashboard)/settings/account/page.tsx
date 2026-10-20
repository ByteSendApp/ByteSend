"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import AccountSettings from "./account-settings";

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your sign-in email, backup email, two-factor authentication and connected accounts. These are yours, not the team's." />
      <AccountSettings />
    </>
  );
}
