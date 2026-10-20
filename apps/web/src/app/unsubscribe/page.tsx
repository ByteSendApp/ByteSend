import { unsubscribeContactFromLink } from "~/server/service/campaign-service";
import ReSubscribe from "./re-subscribe";
import { RecipientPage } from "~/components/recipient-page";

export const dynamic = "force-dynamic";

async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const id = params.id as string;
  const hash = params.hash as string;

  if (!id || !hash) {
    return (
      <RecipientPage tone="error" title="This link doesn't work">
        The unsubscribe link looks incomplete. Use the link at the bottom of the email again.
      </RecipientPage>
    );
  }

  const contact = await unsubscribeContactFromLink(id, hash);

  return <ReSubscribe id={id} hash={hash} contact={contact} />;
}

export default UnsubscribePage;
