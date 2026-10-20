"use client";

import { useState } from "react";
import { ArrowRight, Forward, Trash2 } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Input } from "@bytesend/ui/src/input";
import { Panel } from "@bytesend/ui/src/panel";
import { Switch } from "@bytesend/ui/src/switch";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { useTeam } from "~/providers/team-context";

function describe(match: string) {
  if (match === "*") return "Everything";
  return match.includes("@") ? match : `${match}@ (any of your addresses)`;
}

export function ForwardingRules() {
  const { currentIsAdmin } = useTeam();
  const [match, setMatch] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const utils = api.useUtils();
  const rules = api.inbound.rules.useQuery();
  const refresh = () => utils.inbound.rules.invalidate();

  const create = api.inbound.createRule.useMutation({
    onSuccess: async () => {
      setMatch("");
      setForwardTo("");
      await refresh();
      toast.success("Forwarding rule added");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = api.inbound.setRuleEnabled.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const remove = api.inbound.deleteRule.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      {currentIsAdmin ? (
        <Panel title="Add a rule" description='Match a full address, the part before the @ (like "support"), or * for everything.'>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ match, forwardTo });
            }}
          >
            <Input value={match} onChange={(e) => setMatch(e.target.value)} placeholder="support" className="h-8 sm:w-56" aria-label="Match" required />
            <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
            <Input
              value={forwardTo}
              onChange={(e) => setForwardTo(e.target.value)}
              placeholder="team@helpdesk.com"
              type="email"
              className="h-8 sm:w-64"
              aria-label="Forward to"
              required
            />
            <Button size="sm" type="submit" isLoading={create.isPending}>
              Add rule
            </Button>
          </form>
        </Panel>
      ) : null}

      <Panel flush title="Rules" description="Forwarded mail is sent from forwarding@ your domain, with the original sender as the reply-to address. It counts toward your sending.">
        {rules.isLoading ? (
          <ListSkeleton rows={2} />
        ) : !rules.data?.length ? (
          <EmptyState className="py-10" icon={<Forward />} title="No forwarding rules" description="Mail is kept in the inbox and sent to your webhooks. Add a rule to also forward it to a mailbox." />
        ) : (
          <ul className="divide-y divide-border/70">
            {rules.data.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-foreground">{describe(rule.match)}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-muted-foreground">{rule.forwardTo}</span>
                </span>
                {currentIsAdmin ? (
                  <>
                    <Switch checked={rule.enabled} onCheckedChange={(enabled) => toggle.mutate({ id: rule.id, enabled })} aria-label="Enabled" />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate({ id: rule.id })}
                      aria-label="Delete rule"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
