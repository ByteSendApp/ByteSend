"use client";

import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bytesend/ui/src/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bytesend/ui/src/form";

import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as tldts from "tldts";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import { toast } from "@bytesend/ui/src/toaster";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { LimitReason } from "~/lib/constants/plans";

const domainSchema = z.object({
  region: z.string().optional(),
  domain: z.string({ required_error: "Domain is required" }).min(1, {
    message: "Domain is required",
  }),
});

export default function AddDomain() {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setOpen(true);
      router.replace("/domains");
    }
  }, [searchParams, router]);

  const regionQuery = api.domain.getAvailableRegions.useQuery();
  const limitsQuery = api.limits.get.useQuery({ type: LimitReason.DOMAIN });

  const { openModal } = useUpgradeModalStore((s) => s.action);

  const addDomainMutation = api.domain.createDomain.useMutation();
  const purchaseDomainsAddonMutation = api.billing.purchaseAddonDomainSlots.useMutation();

  const domainForm = useForm<z.infer<typeof domainSchema>>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      region: "",
      domain: "",
    },
  });

  const utils = api.useUtils();

  const singleRegion =
    regionQuery.data?.length === 1 ? regionQuery.data[0] : undefined;

  const showRegionSelect = (regionQuery.data?.length ?? 0) > 1;

  // Remaining slots (limit - current count)
  const remaining = limitsQuery.data
    ? limitsQuery.data.limit === -1
      ? -1
      : limitsQuery.data.limit - limitsQuery.data.currentCount
    : 0;
  const isAtLimit = limitsQuery.data?.isLimitReached ?? false;

  async function onDomainAdd(values: z.infer<typeof domainSchema>) {
    const domain = tldts.getDomain(values.domain);
    if (!domain) {
      domainForm.setError("domain", {
        message: "Invalid domain",
      });

      return;
    }

    if (!values.region && !singleRegion) {
      domainForm.setError("region", {
        message: "Region is required",
      });
      return;
    }

    if (isAtLimit) {
      openModal(limitsQuery.data?.reason);
      return;
    }

    addDomainMutation.mutate(
      {
        name: values.domain,
        region: singleRegion ?? values.region ?? "",
      },
      {
        onSuccess: async (data) => {
          utils.domain.domains.invalidate();
          await router.push(`/domains/${data.id}`);
          setOpen(false);
        },
        onError: async (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function onOpenChange(_open: boolean) {
    setOpen(_open);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? onOpenChange(_open) : null)}
    >
      <div className="flex items-center gap-3">
        {limitsQuery.data && limitsQuery.data.limit !== -1 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {limitsQuery.data.currentCount} of {limitsQuery.data.limit} domains
          </span>
        ) : null}
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            Add domain
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a domain</DialogTitle>
          {limitsQuery.data && limitsQuery.data.limit !== -1 && (
            <div className="text-sm text-muted-foreground pt-1">
              Using {limitsQuery.data.currentCount} of {limitsQuery.data.limit} domains
            </div>
          )}
        </DialogHeader>
        <div className="py-2 space-y-6">
          {!isAtLimit && (
            <Form {...domainForm}>
              <form
                onSubmit={domainForm.handleSubmit(onDomainAdd)}
                className="space-y-6"
              >
                <FormField
                  control={domainForm.control}
                  name="domain"
                  render={({ field, formState }) => (
                    <FormItem>
                      <FormLabel>Domain</FormLabel>
                      <FormControl>
                        <Input placeholder="subdomain.example.com" {...field} />
                      </FormControl>
                      {formState.errors.domain ? (
                        <FormMessage />
                      ) : (
                        <FormDescription>
                          Use subdomains to separate transactional and marketing emails.
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />

                {showRegionSelect && (
                  <FormField
                    control={domainForm.control}
                    name="region"
                    render={({ field, formState }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={regionQuery.isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {regionQuery.data?.map((region) => (
                              <SelectItem value={region} key={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formState.errors.region ? (
                          <FormMessage />
                        ) : (
                          <FormDescription>
                            Select the region from where the email is sent.
                          </FormDescription>
                        )}
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addDomainMutation.isPending || limitsQuery.isLoading}
                  >
                    {addDomainMutation.isPending ? "Adding…" : "Add domain"}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          <div className="pt-2 border-t border-border/70">
            {isAtLimit && (
              <p className="text-sm text-muted-foreground mb-3">
                You've reached your domain limit of {limitsQuery.data?.limit}. Purchase an extra slot to add more.
              </p>
            )}
            {!isAtLimit && (
              <p className="text-sm text-muted-foreground mb-3">
                Need more domains? Purchase extra slots for $1/mo each.
              </p>
            )}
            <Button
              onClick={async () => {
                try {
                  const url = await purchaseDomainsAddonMutation.mutateAsync({ quantity: 1 });
                  if (!url) throw new Error("Couldn't open checkout. Try again in a moment.");
                  window.location.href = url;
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to open checkout");
                }
              }}
              disabled={purchaseDomainsAddonMutation.isPending}
              className="w-full"
              variant="outline"
            >
              {purchaseDomainsAddonMutation.isPending ? "Opening checkout…" : "Buy 1 extra domain slot ($1/mo)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
