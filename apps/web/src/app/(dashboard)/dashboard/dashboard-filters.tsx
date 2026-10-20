import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bytesend/ui/src/select";
import { api } from "~/trpc/react";

interface DashboardFiltersProps {
  days: string;
  setDays: (days: string) => void;
  domain: string | null;
  setDomain: (domain: string | null) => void;
}

export default function DashboardFilters({
  days,
  setDays,
  domain,
  setDomain,
}: DashboardFiltersProps) {
  const { data: domainsQuery } = api.domain.domains.useQuery();

  const handleDomain = (val: string) => {
    setDomain(val === "All Domains" ? null : val);
  };

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Select
        value={domain ?? "All Domains"}
        onValueChange={(val) => handleDomain(val)}
      >
        <SelectTrigger className="h-8 min-w-0 flex-1 text-[13px] sm:w-44 sm:flex-none">
          {domain
            ? domainsQuery?.find((d) => d.id === Number(domain))?.name
            : "All domains"}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Domains" className="capitalize">
            All domains
          </SelectItem>
          {domainsQuery &&
            domainsQuery.map((domain) => (
              <SelectItem key={domain.id} value={domain.id.toString()}>
                {domain.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Tabs value={days || "30"} onValueChange={(value) => setDays(value)}>
        <TabsList className="h-8 shrink-0">
          <TabsTrigger value="7">
            7d
          </TabsTrigger>
          <TabsTrigger value="30">
            30d
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
