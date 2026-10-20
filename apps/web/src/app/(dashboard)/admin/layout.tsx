"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Spinner from "@bytesend/ui/src/spinner";
import { isSelfHosted } from "~/utils/common";

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

  return <div className="min-w-0 space-y-5">{children}</div>;
}
