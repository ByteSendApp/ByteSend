import { db } from "~/server/db";
import { attachmentsOf, verifyAttachmentSignature } from "~/server/service/inbound-service";
import { getInboundStore } from "~/server/service/inbound-storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ emailId: string; attachmentId: string }> }) {
  const { emailId, attachmentId } = await params;
  const url = new URL(req.url);
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!verifyAttachmentSignature(emailId, attachmentId, expires, sig)) {
    return new Response("This link has expired or isn't valid.", { status: 403 });
  }

  const email = await db.inboundEmail.findUnique({ where: { id: emailId }, select: { attachments: true } });
  const attachment = email ? attachmentsOf(email).find((a) => a.id === attachmentId) : undefined;
  if (!attachment) return new Response("Not found", { status: 404 });

  const body = await getInboundStore().get(attachment.key);
  const filename = attachment.filename.replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
