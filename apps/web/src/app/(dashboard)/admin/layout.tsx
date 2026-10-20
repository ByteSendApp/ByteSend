"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { H1 } from "@bytesend/ui";
import Spinner from "@bytesend/ui/src/spinner";
import { isCloud, isSelfHosted } from "~/utils/common";
import { AdminCommandSearch } from "./_components/admin-command-search";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = session?.user.isAdmin ?? false;
  const canAccess = isSelfHosted() || isAdmin;

  useEffect(() => {
    if (status === "authenticated" && !canAccess) {
      router.replace("/dashboard");
    }
  }, [status, canAccess, router]);

  if (status === "loading" || !canAccess) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-5 w-5" innerSvgClass="stroke-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <H1>Admin</H1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform health, customers, and infrastructure
          </p>
        </div>
        {isCloud() ? <AdminCommandSearch /> : null}
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
