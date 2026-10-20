import { Button } from "@bytesend/ui/src/button";
import { RecipientPage } from "~/components/recipient-page";
import { confirmDoubleOptInSubscription } from "~/server/service/double-opt-in-service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PUBLIC_CONFIRMATION_ERRORS = new Set([
  "Invalid confirmation link",
  "Confirmation link has expired",
  "Contact not found",
]);

function getConfirmationErrorMessage(error: unknown) {
  if (error instanceof Error && PUBLIC_CONFIRMATION_ERRORS.has(error.message)) {
    return error.message;
  }

  return "Unable to confirm your subscription.";
}

function buildSubscribeUrl({
  contactId,
  expiresAt,
  hash,
  status,
  error,
}: {
  contactId?: string;
  expiresAt?: string;
  hash?: string;
  status?: "success" | "error";
  error?: string;
}) {
  const searchParams = new URLSearchParams();

  if (contactId) searchParams.set("contactId", contactId);
  if (expiresAt) searchParams.set("expiresAt", expiresAt);
  if (hash) searchParams.set("hash", hash);
  if (status) searchParams.set("status", status);
  if (error) searchParams.set("error", error);

  const queryString = searchParams.toString();
  return queryString ? `/subscribe?${queryString}` : "/subscribe";
}

async function confirmSubscriptionAction(formData: FormData) {
  "use server";

  const contactId = formData.get("contactId");
  const expiresAt = formData.get("expiresAt");
  const hash = formData.get("hash");

  if (
    typeof contactId !== "string" ||
    typeof expiresAt !== "string" ||
    typeof hash !== "string"
  ) {
    redirect(
      buildSubscribeUrl({
        status: "error",
        error: "Invalid confirmation link",
      }),
    );
  }

  let redirectUrl: string;

  try {
    await confirmDoubleOptInSubscription({
      contactId,
      expiresAt,
      hash,
    });

    redirectUrl = buildSubscribeUrl({
      status: "success",
    });
  } catch (error) {
    redirectUrl = buildSubscribeUrl({
      contactId,
      expiresAt,
      hash,
      status: "error",
      error: getConfirmationErrorMessage(error),
    });
  }

  redirect(redirectUrl);
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const getSingleValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const params = await searchParams;
  const contactId = getSingleValue(params.contactId);
  const expiresAt = getSingleValue(params.expiresAt);
  const hash = getSingleValue(params.hash);
  const status = getSingleValue(params.status);
  const error = getSingleValue(params.error);

  const expiresAtTimestamp = Number(expiresAt);
  const hasValidExpiry = Number.isFinite(expiresAtTimestamp);
  const isExpired = hasValidExpiry && Date.now() > expiresAtTimestamp;
  const normalizedError =
    status === "error"
      ? getConfirmationErrorMessage(error ? new Error(error) : null)
      : null;
  const isFatalError =
    normalizedError === "Invalid confirmation link" ||
    normalizedError === "Confirmation link has expired" ||
    normalizedError === "Contact not found";

  if (status === "success") {
    return (
      <RecipientPage tone="success" title="You're subscribed">
        Thanks for confirming. You'll get their emails from now on.
      </RecipientPage>
    );
  }

  if (status === "error" && (!contactId || !expiresAt || !hash)) {
    return (
      <RecipientPage tone="error" title="We couldn't confirm that">
        {normalizedError ?? "Unable to confirm your subscription."}
      </RecipientPage>
    );
  }

  if (!contactId || !expiresAt || !hash || !hasValidExpiry) {
    return (
      <RecipientPage tone="error" title="This link doesn't work">
        It may be incomplete or already used. Sign up again to get a new confirmation email.
      </RecipientPage>
    );
  }

  if (isExpired) {
    return (
      <RecipientPage tone="error" title="We couldn't confirm that">
        Confirmation links expire after a while. Sign up again to get a fresh one.
      </RecipientPage>
    );
  }

  return (
    <RecipientPage
      tone="pending"
      title="Confirm your subscription"
      action={
        !isFatalError ? (
          <form action={confirmSubscriptionAction}>
            <input type="hidden" name="contactId" value={contactId} />
            <input type="hidden" name="expiresAt" value={expiresAt} />
            <input type="hidden" name="hash" value={hash} />
            <Button type="submit" className="h-10 w-full">
              Yes, subscribe me
            </Button>
          </form>
        ) : null
      }
    >
      One click and you&apos;re on the list. If you didn&apos;t sign up, ignore this page and you won&apos;t hear from them.
      {normalizedError ? <p className="mt-3 text-destructive">{normalizedError}</p> : null}
    </RecipientPage>
  );
}
