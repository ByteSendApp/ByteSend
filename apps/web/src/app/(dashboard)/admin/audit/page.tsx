"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Search } from "lucide-react";
import { Input } from "@bytesend/ui/src/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
  type AdminAuditTargetType,
} from "~/lib/constants/admin-audit";
import { AdminPageHeader } from "../_components/admin-page-header";
import { AuditLogTable } from "../_components/audit-log-table";

const ALL = "all";

export default function AdminAuditPage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [targetType, setTargetType] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);

  const updateQuery = useDebouncedCallback((value: string) => setQuery(value.trim()), 300);
  const hasFilters = Boolean(query) || targetType !== ALL || action !== ALL;

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Every change made through the admin panel, newest first"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              updateQuery(event.target.value);
            }}
            placeholder="Admin email or target ID"
            className="pl-8"
            aria-label="Search audit log"
          />
        </div>
        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger className="sm:w-40" aria-label="Target type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All targets</SelectItem>
            {ADMIN_AUDIT_TARGET_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">
                {type === "ses" ? "SES region" : type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="sm:w-56" aria-label="Action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {Object.entries(ADMIN_AUDIT_ACTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AuditLogTable
        query={query || undefined}
        targetType={targetType === ALL ? undefined : (targetType as AdminAuditTargetType)}
        action={action === ALL ? undefined : action}
        emptyLabel={hasFilters ? "No entries match these filters" : "No admin actions recorded yet"}
      />
    </>
  );
}
