"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bytesend/ui/src/button";
import { AuthShell } from "~/components/auth/auth-shell";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@bytesend/ui/src/form";
import { Input } from "@bytesend/ui/src/input";
import { Spinner } from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { toast } from "@bytesend/ui/src/toaster";
import JoinTeam from "./JoinTeam";

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
});

export default function CreateTeam() {
  const createTeam = api.team.createTeam.useMutation();
  const utils = api.useUtils();

  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    createTeam.mutate(data, {
      onSuccess: () => {
        utils.team.invalidate();
        router.replace("/dashboard");
      },
      onError: (e) => {
        toast.error(e.message);
      },
    });
  }

  return (
    <AuthShell
      title="Set up your team"
      description="Teams hold your domains, API keys and contacts. You can invite people once it's created."
    >
      <JoinTeam showCreateTeam />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field, formState }) => (
              <FormItem>
                <label htmlFor="team-name" className="text-[13px] font-medium text-foreground">
                  Team name
                </label>
                <FormControl>
                  <Input id="team-name" placeholder="Acme Inc." className="h-10" autoFocus {...field} />
                </FormControl>
                {formState.errors.name ? (
                  <FormMessage />
                ) : (
                  <FormDescription>Usually your company or project. You can change it later.</FormDescription>
                )}
              </FormItem>
            )}
          />
          <Button type="submit" className="h-10 w-full" disabled={createTeam.isPending}>
            {createTeam.isPending ? <Spinner className="size-4" /> : "Create team"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
