"use client";

import { Contact } from "@prisma/client";
import { Button } from "@bytesend/ui/src/button";
import Spinner from "@bytesend/ui/src/spinner";
import { toast } from "@bytesend/ui/src/toaster";
import { useState } from "react";
import { RecipientPage } from "~/components/recipient-page";
import { api } from "~/trpc/react";

export default function ReSubscribe({
  id,
  hash,
  contact,
}: {
  id: string;
  hash: string;
  contact: Contact;
}) {
  const [subscribed, setSubscribed] = useState(false);

  const reSubscribe = api.campaign.reSubscribeContact.useMutation({
    onSuccess: () => {
      toast.success("You have been subscribed again");
      setSubscribed(true);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  return (
    <RecipientPage
      tone={subscribed ? "success" : "removed"}
      title={subscribed ? "You're subscribed again" : "You've been unsubscribed"}
      action={
        !subscribed ? (
          <Button variant="outline" className="h-10 w-full" onClick={() => reSubscribe.mutate({ id, hash })} disabled={reSubscribe.isPending}>
            {reSubscribe.isPending ? <Spinner className="size-4" /> : "Unsubscribed by mistake? Resubscribe"}
          </Button>
        ) : null
      }
    >
      {subscribed ? "You'll get their emails again at " : "You won't get any more of these emails at "}
      <span className="font-medium text-foreground">{contact.email}</span>.
    </RecipientPage>
  );
}
