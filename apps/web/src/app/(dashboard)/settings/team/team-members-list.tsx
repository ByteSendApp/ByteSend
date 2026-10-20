"use client";

import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { Badge } from "@bytesend/ui/src/badge";
import { Panel } from "@bytesend/ui/src/panel";
import { ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { api } from "~/trpc/react";
import { useTeam } from "~/providers/team-context";
import { EditTeamMember } from "./edit-team-member";
import { DeleteTeamMember } from "./delete-team-member";
import { ResendTeamInvite } from "./resend-team-invite";
import { DeleteTeamInvite } from "./delete-team-invite";

function Initial({ text }: { text: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
      {text.charAt(0)}
    </span>
  );
}

export default function TeamMembersList() {
  const { currentIsAdmin } = useTeam();
  const { data: session } = useSession();
  const teamUsersQuery = api.team.getTeamUsers.useQuery();
  const teamInvitesQuery = api.team.getTeamInvites.useQuery();

  const teamMembers = teamUsersQuery.data || [];
  const pendingInvites = teamInvitesQuery.data || [];

  if (teamUsersQuery.isLoading || teamInvitesQuery.isLoading) {
    return (
      <Panel flush>
        <ListSkeleton rows={3} />
      </Panel>
    );
  }

  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead className="w-28">Role</TableHead>
            <TableHead className="hidden w-28 sm:table-cell">Status</TableHead>
            <TableHead className="hidden w-36 md:table-cell">Joined</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamMembers.map((member) => {
            const email = member.user?.email || "Unknown user";
            const isSelf = session?.user.id == member.userId;
            return (
              <TableRow key={member.userId}>
                <TableCell className="max-w-0">
                  <div className="flex items-center gap-2.5">
                    <Initial text={email} />
                    <span className="truncate font-medium text-foreground">
                      {email}
                      {isSelf ? <span className="ml-1.5 font-normal text-muted-foreground">(you)</span> : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.role === "ADMIN" ? "info" : "neutral"} className="capitalize">
                    {member.role.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="success" dot>
                    Active
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDistanceToNow(new Date(member.user.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {currentIsAdmin ? <EditTeamMember teamUser={{ ...member, userId: String(member.userId) }} /> : null}
                    {currentIsAdmin || isSelf ? (
                      <DeleteTeamMember
                        teamUser={{ userId: String(member.userId), role: member.role, email }}
                        self={isSelf}
                      />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {pendingInvites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="max-w-0">
                <div className="flex items-center gap-2.5">
                  <Initial text={invite.email} />
                  <span className="truncate text-muted-foreground">{invite.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="neutral" className="capitalize">
                  {invite.role.toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="warning" dot>
                  Invited
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                Invited {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {currentIsAdmin ? (
                  <div className="flex justify-end gap-1">
                    <ResendTeamInvite invite={invite} />
                    <DeleteTeamInvite invite={invite} />
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
