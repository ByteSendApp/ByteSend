import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { simpleParser, type AddressObject } from "mailparser";
import { confirmSubscription, emitEvents, outcomeFor } from "./events.ts";
import { ACCOUNT_ID, addMessage, persist, state, topicArn, type CapturedMessage } from "./store.ts";
import { renderInbox, renderMessage } from "./ui.ts";
import { deliverInbound, sampleDmarcReport } from "./inbound.ts";

const app = new Hono();

function regionOf(c: Context) {
  const auth = c.req.header("authorization") ?? "";
  return /Credential=[^/]+\/\d+\/([a-z0-9-]+)\//.exec(auth)?.[1] ?? process.env.AWS_REGION ?? "us-east-1";
}

function notFound(c: Context, message: string) {
  c.header("x-amzn-ErrorType", "NotFoundException");
  return c.json({ message }, 404);
}

function identityResponse(name: string) {
  const identity = state.identities[name];
  return {
    IdentityType: name.includes("@") ? "EMAIL_ADDRESS" : "DOMAIN",
    VerifiedForSendingStatus: true,
    VerificationStatus: "SUCCESS",
    FeedbackForwardingStatus: true,
    DkimAttributes: {
      SigningEnabled: true,
      Status: "SUCCESS",
      SigningAttributesOrigin: "EXTERNAL",
      Tokens: identity?.dkimSelector ? [identity.dkimSelector] : [],
    },
    MailFromAttributes: {
      MailFromDomain: identity?.mailFromDomain ?? `mail.${name}`,
      MailFromDomainStatus: "SUCCESS",
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    },
    ConfigurationSetName: identity?.configurationSetName,
    Tags: [],
  };
}

function ensureIdentity(name: string, region: string) {
  return (state.identities[name] ??= { name, region, createdAt: new Date().toISOString() });
}

app.post("/v2/email/identities", async (c) => {
  const body = await c.req.json<{ EmailIdentity: string; ConfigurationSetName?: string; DkimSigningAttributes?: { DomainSigningSelector?: string } }>();
  state.identities[body.EmailIdentity] = {
    name: body.EmailIdentity,
    region: regionOf(c),
    configurationSetName: body.ConfigurationSetName,
    dkimSelector: body.DkimSigningAttributes?.DomainSigningSelector,
    createdAt: new Date().toISOString(),
  };
  persist();
  const { IdentityType, VerifiedForSendingStatus, DkimAttributes } = identityResponse(body.EmailIdentity);
  return c.json({ IdentityType, VerifiedForSendingStatus, DkimAttributes });
});

app.get("/v2/email/identities/:name", (c) => c.json(identityResponse(decodeURIComponent(c.req.param("name")))));

app.delete("/v2/email/identities/:name", (c) => {
  delete state.identities[decodeURIComponent(c.req.param("name"))];
  persist();
  return c.json({});
});

app.put("/v2/email/identities/:name/mail-from", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const body = await c.req.json<{ MailFromDomain?: string }>();
  ensureIdentity(name, regionOf(c)).mailFromDomain = body.MailFromDomain;
  persist();
  return c.json({});
});

app.put("/v1/email/identities/:name/dkim/signing", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const body = await c.req.json<{ SigningAttributes?: { DomainSigningSelector?: string } }>();
  const selector = body.SigningAttributes?.DomainSigningSelector;
  ensureIdentity(name, regionOf(c)).dkimSelector = selector;
  persist();
  return c.json({ DkimStatus: "SUCCESS", DkimTokens: selector ? [selector] : [] });
});

app.post("/v2/email/configuration-sets", async (c) => {
  const body = await c.req.json<{ ConfigurationSetName: string }>();
  state.configurationSets[body.ConfigurationSetName] ??= {};
  persist();
  return c.json({});
});

type EventDestinationBody = { Enabled?: boolean; MatchingEventTypes?: string[]; SnsDestination?: { TopicArn?: string } };

app.post("/v2/email/configuration-sets/:set/event-destinations", async (c) => {
  const set = decodeURIComponent(c.req.param("set"));
  const body = await c.req.json<{ EventDestinationName: string; EventDestination: EventDestinationBody }>();
  state.configurationSets[set] ??= {};
  state.configurationSets[set][body.EventDestinationName] = {
    name: body.EventDestinationName,
    enabled: body.EventDestination.Enabled ?? true,
    matchingEventTypes: body.EventDestination.MatchingEventTypes ?? [],
    topicArn: body.EventDestination.SnsDestination?.TopicArn,
  };
  persist();
  return c.json({});
});

app.put("/v2/email/configuration-sets/:set/event-destinations/:dest", async (c) => {
  const set = decodeURIComponent(c.req.param("set"));
  const dest = decodeURIComponent(c.req.param("dest"));
  const body = await c.req.json<{ EventDestination: EventDestinationBody }>();
  state.configurationSets[set] ??= {};
  state.configurationSets[set][dest] = {
    name: dest,
    enabled: body.EventDestination.Enabled ?? true,
    matchingEventTypes: body.EventDestination.MatchingEventTypes ?? [],
    topicArn: body.EventDestination.SnsDestination?.TopicArn,
  };
  persist();
  return c.json({});
});

app.get("/v2/email/configuration-sets/:set/event-destinations", (c) => {
  const set = state.configurationSets[decodeURIComponent(c.req.param("set"))];
  if (!set) return notFound(c, "Configuration set does not exist");
  return c.json({
    EventDestinations: Object.values(set).map((d) => ({
      Name: d.name,
      Enabled: d.enabled,
      MatchingEventTypes: d.matchingEventTypes,
      ...(d.topicArn ? { SnsDestination: { TopicArn: d.topicArn } } : {}),
    })),
  });
});

app.get("/v2/email/account", (c) =>
  c.json({
    DedicatedIpAutoWarmupEnabled: false,
    EnforcementStatus: "HEALTHY",
    ProductionAccessEnabled: true,
    SendingEnabled: true,
    SendQuota: { Max24HourSend: 1_000_000, MaxSendRate: 100, SentLast24Hours: state.messages.length },
  }),
);

app.delete("/v2/email/suppression/addresses/:address", (c) => c.json({}));
app.post("/v2/email/tenants/resources", (c) => c.json({}));
app.post("/v2/email/tenants/resources/delete", (c) => c.json({}));

app.post("/v2/email/outbound-emails", async (c) => {
  const body = await c.req.json<{
    FromEmailAddress?: string;
    Destination?: { ToAddresses?: string[]; CcAddresses?: string[]; BccAddresses?: string[] };
    Content: { Raw?: { Data: string }; Simple?: { Subject?: { Data?: string }; Body?: { Html?: { Data?: string }; Text?: { Data?: string } } } };
    ConfigurationSetName?: string;
    EmailTags?: Array<{ Name: string; Value: string }>;
  }>();

  const region = regionOf(c);
  const id = `${Date.now().toString(16).padStart(16, "0")}-${randomUUID()}-000000`;
  const addresses = (field?: AddressObject | AddressObject[]) =>
    (Array.isArray(field) ? field : field ? [field] : []).flatMap((a) => a.value.map((v) => v.address ?? "")).filter(Boolean);

  let message: CapturedMessage;
  if (body.Content.Raw) {
    const parsed = await simpleParser(Buffer.from(body.Content.Raw.Data, "base64"));
    const to = [
      ...(body.Destination?.ToAddresses ?? []),
      ...(body.Destination?.CcAddresses ?? []),
      ...(body.Destination?.BccAddresses ?? []),
    ];
    const recipients = to.length ? to : [...addresses(parsed.to), ...addresses(parsed.cc), ...addresses(parsed.bcc)];
    message = {
      id,
      region,
      configurationSetName: body.ConfigurationSetName,
      from: body.FromEmailAddress ?? parsed.from?.value[0]?.address ?? "",
      to: recipients,
      subject: parsed.subject ?? "",
      html: typeof parsed.html === "string" ? parsed.html : undefined,
      text: parsed.text,
      headers: parsed.headerLines.map((h) => ({ name: h.key, value: h.line.slice(h.key.length + 1).trim() })),
      outcome: outcomeFor(recipients),
      receivedAt: new Date().toISOString(),
    };
  } else {
    const to = [...(body.Destination?.ToAddresses ?? []), ...(body.Destination?.CcAddresses ?? []), ...(body.Destination?.BccAddresses ?? [])];
    message = {
      id,
      region,
      configurationSetName: body.ConfigurationSetName,
      from: body.FromEmailAddress ?? "",
      to,
      subject: body.Content.Simple?.Subject?.Data ?? "",
      html: body.Content.Simple?.Body?.Html?.Data,
      text: body.Content.Simple?.Body?.Text?.Data,
      headers: [],
      outcome: outcomeFor(to),
      receivedAt: new Date().toISOString(),
    };
  }

  addMessage(message);

  const destinations = Object.values(state.configurationSets[body.ConfigurationSetName ?? ""] ?? {}).filter((d) => d.enabled && d.topicArn);
  const tags: Record<string, string[]> = { "ses:configuration-set": body.ConfigurationSetName ? [body.ConfigurationSetName] : [] };
  for (const tag of body.EmailTags ?? []) tags[tag.Name] = [tag.Value];
  emitEvents(message, destinations.map((d) => ({ arn: d.topicArn!, types: d.matchingEventTypes })), tags);

  console.log(`[local-ses-sns] ${message.outcome.padEnd(10)} ${message.subject} → ${message.to.join(", ")}`);
  return c.json({ MessageId: id });
});

const xml = (c: Context, action: string, result: string, ns = "http://sns.amazonaws.com/doc/2010-03-31/") =>
  c.body(
    `<${action}Response xmlns="${ns}"><${action}Result>${result}</${action}Result><ResponseMetadata><RequestId>${randomUUID()}</RequestId></ResponseMetadata></${action}Response>`,
    200,
    { "Content-Type": "text/xml" },
  );

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

app.post("/", async (c) => {
  const form = new URLSearchParams(await c.req.text());
  const action = form.get("Action");
  const region = regionOf(c);

  switch (action) {
    case "CreateTopic": {
      const arn = topicArn(region, form.get("Name") ?? "topic");
      if (!state.topics.includes(arn)) state.topics.push(arn);
      persist();
      return xml(c, action, `<TopicArn>${arn}</TopicArn>`);
    }
    case "DeleteTopic": {
      const arn = form.get("TopicArn");
      state.topics = state.topics.filter((t) => t !== arn);
      state.subscriptions = state.subscriptions.filter((s) => s.topicArn !== arn);
      persist();
      return xml(c, action, "");
    }
    case "Subscribe": {
      const subscription = {
        arn: `${form.get("TopicArn")}:${randomUUID()}`,
        topicArn: form.get("TopicArn") ?? "",
        protocol: form.get("Protocol") ?? "https",
        endpoint: form.get("Endpoint") ?? "",
      };
      state.subscriptions = state.subscriptions.filter((s) => !(s.topicArn === subscription.topicArn && s.endpoint === subscription.endpoint));
      state.subscriptions.push(subscription);
      persist();
      if (subscription.protocol.startsWith("http")) confirmSubscription(subscription.topicArn, subscription.endpoint);
      return xml(c, action, `<SubscriptionArn>${subscription.arn}</SubscriptionArn>`);
    }
    case "Unsubscribe": {
      state.subscriptions = state.subscriptions.filter((s) => s.arn !== form.get("SubscriptionArn"));
      persist();
      return xml(c, action, "");
    }
    case "ListSubscriptionsByTopic": {
      const members = state.subscriptions
        .filter((s) => s.topicArn === form.get("TopicArn"))
        .map(
          (s) =>
            `<member><SubscriptionArn>${s.arn}</SubscriptionArn><Owner>${ACCOUNT_ID}</Owner><Protocol>${s.protocol}</Protocol><Endpoint>${escape(s.endpoint)}</Endpoint><TopicArn>${s.topicArn}</TopicArn></member>`,
        )
        .join("");
      return xml(c, action, `<Subscriptions>${members}</Subscriptions>`);
    }
    case "GetCallerIdentity":
      return xml(c, action, `<Arn>arn:aws:iam::${ACCOUNT_ID}:user/local</Arn><UserId>LOCAL</UserId><Account>${ACCOUNT_ID}</Account>`, "https://sts.amazonaws.com/doc/2011-06-15/");
    default:
      console.warn(`[local-ses-sns] unsupported action ${action}, answering with an empty result`);
      return xml(c, action ?? "Unknown", "");
  }
});

app.get("/", (c) => c.html(renderInbox(state.messages, { status: c.req.query("inbound"), detail: c.req.query("detail") })));

app.post("/inbound", async (c) => {
  const form = await c.req.parseBody();
  const file = form.attachment;
  const result = await deliverInbound({
    from: String(form.from || "sender@example.com"),
    to: String(form.to || ""),
    subject: String(form.subject || "Test message"),
    text: String(form.text || ""),
    attachment:
      file instanceof File && file.size > 0
        ? { filename: file.name, contentType: file.type || "application/octet-stream", content: Buffer.from(await file.arrayBuffer()) }
        : undefined,
  });
  console.log(`[local-ses-sns] inbound → ${form.to}: ${result.status} ${result.body}`);
  const accepted = result.status >= 200 && result.status < 300;
  return c.redirect(`/?inbound=${accepted ? "sent" : "failed"}&detail=${encodeURIComponent(`${result.status} ${result.body}`.slice(0, 200))}`);
});

app.post("/dmarc", async (c) => {
  const form = await c.req.parseBody();
  const domain = String(form.domain || "").trim().toLowerCase();
  const result = await deliverInbound({
    from: "noreply-dmarc-support@google.com",
    to: String(form.to || ""),
    subject: `Report domain: ${domain} Submitter: google.com Report-ID: ${Date.now()}`,
    text: "This is an aggregate report from google.com.",
    attachment: sampleDmarcReport(domain, String(form.selector || "bytesend")),
  });
  console.log(`[local-ses-sns] DMARC report for ${domain} → ${form.to}: ${result.status} ${result.body}`);
  const accepted = result.status >= 200 && result.status < 300;
  return c.redirect(`/?inbound=${accepted ? "sent" : "failed"}&detail=${encodeURIComponent(`${result.status} ${result.body}`.slice(0, 200))}`);
});

app.post("/api/inbound", async (c) => {
  const body = await c.req.json<{ from?: string; to: string; subject?: string; text?: string; html?: string }>();
  return c.json(await deliverInbound({ from: body.from ?? "sender@example.com", to: body.to, subject: body.subject ?? "Test message", text: body.text ?? "", html: body.html }));
});
app.get("/messages/:id", (c) => {
  const message = state.messages.find((m) => m.id === c.req.param("id"));
  return message ? c.html(renderMessage(message)) : c.text("Not found", 404);
});
app.get("/api/messages", (c) => c.json(state.messages));
app.delete("/api/messages", (c) => {
  state.messages.length = 0;
  persist();
  return c.json({});
});
app.get("/health", (c) => c.json({ ok: true }));

app.all("*", (c) => {
  console.warn(`[local-ses-sns] unsupported ${c.req.method} ${c.req.path}, answering with {}`);
  return c.json({});
});

const port = Number(process.env.PORT ?? 5350);
serve({ fetch: app.fetch, port }, () => console.log(`[local-ses-sns] listening on :${port}, inbox at http://localhost:${port}/`));
