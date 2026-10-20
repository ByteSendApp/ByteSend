import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { reachable } from "./events.ts";

const CALLBACK_URL = process.env.INBOUND_CALLBACK_URL ?? "http://localhost:3000/api/inbound_callback";
const TOPIC_ARN = process.env.INBOUND_TOPIC_ARN ?? "arn:aws:sns:us-east-1:000000000000:bytesend-inbound";

export type InboundForm = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachment?: { filename: string; contentType: string; content: Buffer };
};

function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

export function buildMime(form: InboundForm) {
  const boundary = `----local-${randomUUID()}`;
  const messageId = `<${randomUUID()}@local-ses-sns>`;
  const lines = [
    `From: ${form.from}`,
    `To: ${form.to}`,
    `Subject: ${encodeHeader(form.subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(form.text).toString("base64"),
  ];
  if (form.html) {
    lines.push(`--${boundary}`, 'Content-Type: text/html; charset="utf-8"', "Content-Transfer-Encoding: base64", "", Buffer.from(form.html).toString("base64"));
  }
  if (form.attachment) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${form.attachment.contentType}; name="${form.attachment.filename}"`,
      `Content-Disposition: attachment; filename="${form.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      form.attachment.content.toString("base64").replace(/.{1,76}/g, "$&\r\n").trim(),
    );
  }
  lines.push(`--${boundary}--`, "");
  return Buffer.from(lines.join("\r\n"));
}

export async function deliverInbound(form: InboundForm) {
  const raw = buildMime(form);
  const sesId = randomUUID().replace(/-/g, "");
  const recipients = form.to.split(",").map((r) => r.trim()).filter(Boolean);
  const pass = { status: "PASS" };
  const message = {
    notificationType: "Received",
    mail: { messageId: sesId, timestamp: new Date().toISOString(), source: form.from, destination: recipients },
    receipt: {
      recipients,
      spamVerdict: pass,
      virusVerdict: pass,
      spfVerdict: pass,
      dkimVerdict: pass,
      dmarcVerdict: pass,
      action: { type: "SNS", topicArn: TOPIC_ARN, encoding: "BASE64" },
    },
    content: raw.toString("base64"),
  };
  const response = await fetch(reachable(CALLBACK_URL), {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=UTF-8", "x-amz-sns-message-type": "Notification" },
    body: JSON.stringify({
      Type: "Notification",
      MessageId: randomUUID(),
      TopicArn: TOPIC_ARN,
      Message: JSON.stringify(message),
      Timestamp: new Date().toISOString(),
      SignatureVersion: "1",
      Signature: "local",
    }),
  });
  return { status: response.status, body: await response.text() };
}

export function sampleDmarcReport(domain: string, selector = "bytesend") {
  const end = Math.floor(Date.now() / 86_400_000) * 86_400;
  const begin = end - 86_400;
  const reportId = String(Date.now());
  const record = (ip: string, count: number, disposition: string, dkim: string, spf: string, auth: string) => `
  <record>
    <row><source_ip>${ip}</source_ip><count>${count}</count>
      <policy_evaluated><disposition>${disposition}</disposition><dkim>${dkim}</dkim><spf>${spf}</spf></policy_evaluated></row>
    <identifiers><header_from>${domain}</header_from></identifiers>
    <auth_results>${auth}</auth_results>
  </record>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata><org_name>google.com</org_name><email>noreply-dmarc-support@google.com</email>
    <report_id>${reportId}</report_id><date_range><begin>${begin}</begin><end>${end - 1}</end></date_range></report_metadata>
  <policy_published><domain>${domain}</domain><adkim>r</adkim><aspf>r</aspf><p>none</p><sp>none</sp><pct>100</pct></policy_published>${record(
    "54.240.8.1",
    1240,
    "none",
    "pass",
    "pass",
    `<dkim><domain>${domain}</domain><selector>${selector}</selector><result>pass</result></dkim><spf><domain>mail.${domain}</domain><result>pass</result></spf>`,
  )}${record(
    "209.85.220.41",
    86,
    "none",
    "pass",
    "fail",
    `<dkim><domain>${domain}</domain><selector>google</selector><result>pass</result></dkim><spf><domain>${domain}</domain><result>softfail</result></spf>`,
  )}${record("185.220.101.7", 12, "none", "fail", "fail", `<spf><domain>bulk-mailer.example</domain><result>fail</result></spf>`)}
</feedback>`;
  return {
    filename: `google.com!${domain}!${begin}!${end - 1}.xml.gz`,
    contentType: "application/gzip",
    content: gzipSync(Buffer.from(xml)),
  };
}
