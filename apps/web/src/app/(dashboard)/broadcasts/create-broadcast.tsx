"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "@bytesend/ui/src/toaster";
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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@bytesend/ui/src/form";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    from: z.string().min(1, "From email is required"),
    subject: z.string().min(1, "Subject is required"),
});

export default function CreateBroadcast() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const createMutation = api.campaign.createCampaign.useMutation();
    const utils = api.useUtils();

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", from: "", subject: "" },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        createMutation.mutate(
            { ...values, intent: "BROADCAST" },
            {
                onSuccess: (data) => {
                    utils.campaign.getCampaigns.invalidate();
                    router.push(`/broadcasts/${data.id}/compose`);
                    toast.success("Broadcast created");
                    setOpen(false);
                },
                onError: (e) => toast.error(e.message),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="size-3.5" />
                    New broadcast
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Broadcast</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4 pt-2"
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Product Update: June"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="from"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Updates <updates@example.com>"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject</FormLabel>
                                    <FormControl>
                                        <Input placeholder="What's new in June" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            className="w-full"
                            isLoading={createMutation.isPending}
                        >
                            Create Broadcast
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
