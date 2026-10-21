import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "~/components/marketing/tools/tool-page";
import { isCloud } from "~/utils/common";
import { SpfChecker } from "./spf-checker";

export const metadata: Metadata = {
  title: "Free SPF checker – ByteSend",
  description: "Check any domain's SPF record: which servers it allows, how many DNS lookups it uses, and whether it's broken.",
  alternates: { canonical: "https://bytesend.cloud/tools/spf" },
};

const FAQ = [
  {
    q: "What is SPF?",
    a: "A DNS record listing the servers allowed to send email for your domain. Mail providers check it to spot mail from servers you didn't authorise.",
  },
  {
    q: "What's the 10-lookup limit?",
    a: "Each include:, a, mx, ptr, exists and redirect= costs a DNS lookup, including the ones inside the records you include. Go over 10 and SPF fails for every message. It's the most common way SPF breaks as you add providers.",
  },
  {
    q: "Should I use ~all or -all?",
    a: "~all is what most senders use: unlisted servers are marked suspicious and DMARC decides what happens. -all is stricter. Both are fine once DMARC is in place. Never use +all.",
  },
  {
    q: "Where does ByteSend's SPF go?",
    a: "On a mail. subdomain of your domain, which ByteSend uses as the bounce address. So it doesn't touch your main SPF record or its lookup count.",
  },
];

export default function SpfCheckerPage() {
  if (!isCloud()) notFound();

  return (
    <ToolPage
      current="/tools/spf"
      title="SPF checker"
      intro="Check any domain's SPF record: which servers it allows, how many of its 10 DNS lookups it uses, and whether it's broken. No sign-up needed."
      checker={<SpfChecker />}
      explainer={{
        title: "How the record ends matters",
        items: [
          { label: "-all", title: "Fail", text: "Mail from unlisted servers fails SPF. The strictest option." },
          { label: "~all", title: "Soft fail", text: "Unlisted servers are marked suspicious, and DMARC decides. What most senders use." },
          { label: "+all", title: "Allow everything", text: "Any server may send as you. This defeats the point of SPF, so never use it." },
        ],
      }}
      faq={FAQ}
    />
  );
}
