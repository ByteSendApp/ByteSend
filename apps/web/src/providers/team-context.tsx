"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { api } from "~/trpc/react";

const ACTIVE_TEAM_KEY = "bytesend:active-team-id";

type Team = {
  id: number;
  name: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  plan: "FREE" | "BASIC" | "HOBBY" | "LITE" | "LIFETIME";
  stripeCustomerId?: string | null;
  billingEmail?: string | null;
  teamUsers: { role: "ADMIN" | "MEMBER" }[];
};

interface TeamContextType {
  currentTeam: Team | null;
  teams: Team[];
  isLoading: boolean;
  currentRole: "ADMIN" | "MEMBER";
  currentIsAdmin: boolean;
  setCurrentTeam: (teamId: number) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { data: teams, status } = api.team.getTeams.useQuery();
  const utils = api.useUtils();

  const [activeTeamId, setActiveTeamId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(ACTIVE_TEAM_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  useEffect(() => {
    if (!teams || teams.length === 0) return;
    const valid = activeTeamId && teams.some((t) => t.id === activeTeamId);
    if (!valid) {
      const firstId = teams[0]!.id;
      setActiveTeamId(firstId);
      window.localStorage.setItem(ACTIVE_TEAM_KEY, String(firstId));
    }
  }, [teams]);

  const currentTeam =
    (teams && activeTeamId ? teams.find((t) => t.id === activeTeamId) : teams?.[0]) ?? null;

  function setCurrentTeam(teamId: number) {
    setActiveTeamId(teamId);
    window.localStorage.setItem(ACTIVE_TEAM_KEY, String(teamId));
    utils.invalidate();
  }

  const value: TeamContextType = {
    currentTeam,
    teams: teams ?? [],
    isLoading: status === "pending",
    currentRole: currentTeam?.teamUsers[0]?.role ?? "MEMBER",
    currentIsAdmin: currentTeam?.teamUsers[0]?.role === "ADMIN",
    setCurrentTeam,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
