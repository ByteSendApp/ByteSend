"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import Spinner from "@bytesend/ui/src/spinner";
import SesConfigurationActions from "./edit-ses-configuration";
import { TextWithCopyButton } from "@bytesend/ui/src/text-with-copy";
import { cn } from "@bytesend/ui/lib/utils";

export default function SesConfigurations() {
  const sesSettingsQuery = api.admin.getSesSettings.useQuery();

  return (
    <div className="">
      <div className="border rounded-xl shadow">
        <Table className="">
          <TableHeader className="">
            <TableRow className=" bg-muted/30">
              <TableHead className="rounded-tl-xl">Region</TableHead>
              <TableHead>Prefix Key</TableHead>
              <TableHead>Callback URL</TableHead>
              <TableHead>Callback status</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead>Send rate</TableHead>
              <TableHead>Transactional quota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sesSettingsQuery.isLoading ? (
              <TableRow className="h-32">
                <TableCell colSpan={9} className="text-center py-4">
                  <Spinner
                    className="w-6 h-6 mx-auto"
                    innerSvgClass="stroke-primary"
                  />
                </TableCell>
              </TableRow>
            ) : sesSettingsQuery.data?.length === 0 ? (
              <TableRow className="h-32">
                <TableCell colSpan={9} className="text-center py-4">
                  <p>No SES configurations added</p>
                </TableCell>
              </TableRow>
            ) : (
              sesSettingsQuery.data?.map((sesSetting) => (
                <TableRow
                  key={sesSetting.id}
                  className={cn(!sesSetting.isActive && "opacity-60")}
                >
                  <TableCell>{sesSetting.region}</TableCell>
                  <TableCell>{sesSetting.idPrefix}</TableCell>
                  <TableCell>
                    <div className="w-[200px] overflow-hidden text-ellipsis">
                      <TextWithCopyButton
                        value={sesSetting.callbackUrl}
                        className="w-[200px] overflow-hidden text-ellipsis"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {sesSetting.callbackSuccess ? "Success" : "Failed"}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(sesSetting.createdAt)} ago
                  </TableCell>
                  <TableCell>{sesSetting.sesEmailRateLimit}</TableCell>
                  <TableCell>{sesSetting.transactionalQuota}%</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        sesSetting.isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          sesSetting.isActive ? "bg-emerald-500" : "bg-muted-foreground"
                        )}
                      />
                      {sesSetting.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SesConfigurationActions setting={sesSetting} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
