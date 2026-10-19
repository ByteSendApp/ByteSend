"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@bytesend/ui/src/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bytesend/ui/src/form";
import { Input } from "@bytesend/ui/src/input";
import { Switch } from "@bytesend/ui/src/switch";
import { toast } from "@bytesend/ui/src/toaster";
import type { Plan } from "@prisma/client";
import { api } from "~/trpc/react";

const settingsSchema = z.object({
  apiRateLimit: z.coerce.number().int().min(-1).max(10_000),
  dailyEmailLimit: z.coerce.number().int().min(-1).max(10_000_000),
  extraDomainSlots: z.coerce.number().int().min(0).max(1_000),
  extraMemberSlots: z.coerce.number().int().min(0).max(1_000),
});

type SettingsInput = z.infer<typeof settingsSchema>;

export type TeamSettingsValues = SettingsInput & { id: number; plan: Plan; isBlocked: boolean };

function toFormValues(team: TeamSettingsValues): SettingsInput {
  return {
    apiRateLimit: team.apiRateLimit,
    dailyEmailLimit: team.dailyEmailLimit,
    extraDomainSlots: team.extraDomainSlots,
    extraMemberSlots: team.extraMemberSlots,
  };
}

function NumberField({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={Number.isNaN(value) ? "" : value}
      onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
      disabled={disabled}
      placeholder={placeholder}
      className="font-mono tabular-nums"
    />
  );
}

export function TeamSettingsCard({ team }: { team: TeamSettingsValues }) {
  const utils = api.useUtils();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(team),
  });

  useEffect(() => {
    form.reset(toFormValues(team));
  }, [team, form]);

  const updateTeam = api.admin.updateTeamSettings.useMutation({
    onSuccess: async () => {
      toast.success("Team settings updated");
      await Promise.all([
        utils.admin.getTeamDetail.invalidate({ teamId: team.id }),
        utils.admin.listAuditLog.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not update team", { description: error.message }),
  });

  const isPending = updateTeam.isPending;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-sm font-medium text-foreground">Limits</h3>
        <p className="text-xs text-muted-foreground">
          Overrides on top of the {team.plan} plan. Changes are recorded in the audit log.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) =>
            updateTeam.mutate({ teamId: team.id, plan: team.plan, isBlocked: team.isBlocked, ...values }),
          )}
          className="grid gap-5 md:grid-cols-2"
          noValidate
        >
          <FormField
            control={form.control}
            name="apiRateLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API rate limit</FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <NumberField
                      value={field.value === -1 ? Number.NaN : field.value}
                      onChange={field.onChange}
                      min={1}
                      max={10_000}
                      disabled={isPending || field.value === -1}
                      placeholder={field.value === -1 ? "No limit" : undefined}
                    />
                  </FormControl>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={field.value === -1}
                      onCheckedChange={(checked) => field.onChange(checked ? -1 : 2)}
                      disabled={isPending}
                    />
                    Unlimited
                  </label>
                </div>
                <FormDescription>Requests per second per API key.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dailyEmailLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily email limit</FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <NumberField
                      value={field.value === -1 ? Number.NaN : field.value}
                      onChange={field.onChange}
                      min={0}
                      max={10_000_000}
                      disabled={isPending || field.value === -1}
                      placeholder={field.value === -1 ? "No daily cap" : "0 uses plan default"}
                    />
                  </FormControl>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={field.value === -1}
                      onCheckedChange={(checked) => field.onChange(checked ? -1 : 0)}
                      disabled={isPending}
                    />
                    Unlimited
                  </label>
                </div>
                <FormDescription>0 uses the plan default.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="extraDomainSlots"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extra domain slots</FormLabel>
                <FormControl>
                  <NumberField value={field.value} onChange={field.onChange} min={0} max={1_000} disabled={isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="extraMemberSlots"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extra member slots</FormLabel>
                <FormControl>
                  <NumberField value={field.value} onChange={field.onChange} min={0} max={1_000} disabled={isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !form.formState.isDirty}
              onClick={() => form.reset(toFormValues(team))}
            >
              Reset
            </Button>
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
