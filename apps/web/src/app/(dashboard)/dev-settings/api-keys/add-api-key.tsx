"use client";

import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bytesend/ui/src/dialog";

import { api } from "~/trpc/react";
import { useState } from "react";
import { CheckIcon, ClipboardCopy, Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "@bytesend/ui/src/toaster";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bytesend/ui/src/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";

const apiKeySchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1, {
    message: "Name is required",
  }),
  domainId: z.string().optional(),
  mode: z.enum(["live", "test"]),
});

const MODES = [
  { value: "live", label: "Live", description: "Sends real email." },
  { value: "test", label: "Test", description: "Nothing is delivered. Events and webhooks are simulated." },
] as const;

export default function AddApiKey() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const createApiKeyMutation = api.apiKey.createToken.useMutation();
  const [isCopied, setIsCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const domainsQuery = api.domain.domains.useQuery();

  const utils = api.useUtils();

  const apiKeyForm = useForm<z.infer<typeof apiKeySchema>>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
      domainId: "all",
      mode: "live",
    },
  });

  function handleSave(values: z.infer<typeof apiKeySchema>) {
    createApiKeyMutation.mutate(
      {
        name: values.name,
        permission: "FULL",
        domainId:
          values.domainId === "all" ? undefined : Number(values.domainId),
        isTest: values.mode === "test",
      },
      {
        onSuccess: (data) => {
          utils.apiKey.invalidate();
          setApiKey(data);
          apiKeyForm.reset();
        },
      }
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  }

  function copyAndClose() {
    handleCopy();
    setApiKey("");
    setOpen(false);
    setShowApiKey(false);
    toast.success("API key copied to clipboard");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? setOpen(_open) : null)}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" />
          Create API key
        </Button>
      </DialogTrigger>
      {apiKey ? (
        <DialogContent key={apiKey}>
          <DialogHeader>
            <DialogTitle>Copy API key</DialogTitle>
          </DialogHeader>
          <div className="py-1 bg-secondary rounded-lg px-4 flex items-center justify-between mt-2">
            <div>
              {showApiKey ? (
                <p className="text-sm">{apiKey}</p>
              ) : (
                <div className="flex gap-1">
                  {Array.from({ length: 40 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-1 h-1 bg-muted-foreground rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                variant="ghost"
                className="hover:bg-transparent p-0 cursor-pointer  group-hover:opacity-100"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                className="hover:bg-transparent p-0 cursor-pointer  group-hover:opacity-100"
                onClick={handleCopy}
              >
                {isCopied ? (
                  <CheckIcon className="h-4 w-4 text-green" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div></div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={copyAndClose}
              disabled={createApiKeyMutation.isPending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new API key</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Form {...apiKeyForm}>
              <form
                onSubmit={apiKeyForm.handleSubmit(handleSave)}
                className="space-y-8"
              >
                <FormField
                  control={apiKeyForm.control}
                  name="name"
                  render={({ field, formState }) => (
                    <FormItem>
                      <FormLabel>API key name</FormLabel>
                      <FormControl>
                        <Input placeholder="prod key" {...field} />
                      </FormControl>
                      {formState.errors.name ? (
                        <FormMessage />
                      ) : (
                        <FormDescription>
                          Use a name to easily identify this API key.
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={apiKeyForm.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <div role="radiogroup" aria-label="Mode" className="grid grid-cols-2 gap-2">
                        {MODES.map((mode) => (
                          <button
                            key={mode.value}
                            type="button"
                            role="radio"
                            aria-checked={field.value === mode.value}
                            onClick={() => field.onChange(mode.value)}
                            className={`rounded-md border px-3 py-2 text-left transition-colors ${
                              field.value === mode.value ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <span className="block text-sm font-medium text-foreground">{mode.label}</span>
                            <span className="block text-xs text-muted-foreground">{mode.description}</span>
                          </button>
                        ))}
                      </div>
                      <FormDescription>
                        Test keys start with <code className="font-mono">bs_test_</code> and work before your domain is verified.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={apiKeyForm.control}
                  name="domainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain access</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select domain access" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Domains</SelectItem>
                          {domainsQuery.data?.map(
                            (domain: { id: number; name: string }) => (
                              <SelectItem
                                key={domain.id}
                                value={domain.id.toString()}
                              >
                                {domain.name}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which domain this API key can send emails from.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button
                    className=" w-[100px] hover:bg-gray-100 focus:bg-gray-100"
                    type="submit"
                    disabled={createApiKeyMutation.isPending}
                  >
                    {createApiKeyMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
