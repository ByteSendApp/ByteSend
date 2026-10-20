"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import InviteTeamMember from "../team/invite-team-member";
import TeamMembersList from "../team/team-members-list";
import { useTeam } from "~/providers/team-context";

export default function MembersPage() {
  const { currentIsAdmin } = useTeam();

  return (
    <>
      <PageHeader
        title="Members"
        description="People in this team. Admins can manage domains, billing and members; members can send and view everything else."
        actions={currentIsAdmin ? <InviteTeamMember /> : null}
      />
      <TeamMembersList />
    </>
  );
}
