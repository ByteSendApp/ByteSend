import { paths } from "../types/schema";
import { ErrorResponse } from "../types";
import { ByteSend } from "./bytesend";

type ListInboundEmailsQuery = NonNullable<paths["/v1/inbound/emails"]["get"]["parameters"]["query"]>;

type ListInboundEmailsResponseSuccess =
  paths["/v1/inbound/emails"]["get"]["responses"]["200"]["content"]["application/json"];

type ListInboundEmailsResponse = {
  data: ListInboundEmailsResponseSuccess | null;
  error: ErrorResponse | null;
};

export type InboundEmail =
  paths["/v1/inbound/emails/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type InboundEmailSummary = ListInboundEmailsResponseSuccess["data"][number];

export type InboundAttachment = InboundEmail["attachments"][number];

type GetInboundEmailResponse = {
  data: InboundEmail | null;
  error: ErrorResponse | null;
};

export class Inbound {
  constructor(private readonly bytesend: ByteSend) {
    this.bytesend = bytesend;
  }

  async list(query?: ListInboundEmailsQuery): Promise<ListInboundEmailsResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.recipient) params.set("recipient", query.recipient);
    if (query?.since) params.set("since", query.since);

    const queryString = params.toString();
    const path = queryString ? `/inbound/emails?${queryString}` : "/inbound/emails";
    return this.bytesend.get<ListInboundEmailsResponseSuccess>(path);
  }

  async get(id: string): Promise<GetInboundEmailResponse> {
    return this.bytesend.get<InboundEmail>(`/inbound/emails/${encodeURIComponent(id)}`);
  }

  async downloadAttachment(attachment: { url?: string | null; filename?: string }): Promise<ArrayBuffer> {
    if (!attachment.url) {
      throw new Error(`No download link for ${attachment.filename ?? "this attachment"}. Fetch the email again with inbound.get() for a fresh one.`);
    }
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? "The attachment link has expired. Fetch the email again with inbound.get() for a fresh one."
          : `Couldn't download the attachment (${response.status}).`,
      );
    }
    return response.arrayBuffer();
  }
}
