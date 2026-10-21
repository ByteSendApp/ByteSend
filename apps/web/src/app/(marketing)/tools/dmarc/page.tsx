import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "~/components/marketing/tools/tool-page";
import { isCloud } from "~/utils/common";
import { DmarcChecker } from "./dmarc-checker";

export const metadata: Metadata = {
  title: "Free DMARC checker – ByteSend",
  description: "Check any domain's DMARC record in seconds: whether it's valid, how strict it is, and what to fix next.",
  alternates: { canonical: "https://bytesend.cloud/tools/dmarc" },
};

const FAQ = [
  {
    q: "What is DMARC?",
    a: "A DNS record that tells mail providers what to do with email that claims to be from your domain but fails SPF and DKIM checks, and where to send reports about it.",
  },
  {
    q: "Do I need it?",
    a: "Yes, if you send email. Gmail and Yahoo require a DMARC record from anyone sending in bulk, and without one your domain is easy to spoof in phishing.",
  },
  {
    q: "Why not go straight to p=reject?",
    a: "Because any legitimate service sending as your domain that isn't set up yet, like a helpdesk or CRM, would have its mail rejected too. Start with p=none, read the reports, fix what fails, then tighten the policy.",
  },
  {
    q: "What are DMARC reports?",
    a: "Daily summaries from Google, Microsoft, Yahoo and others listing every server that sent mail as your domain and whether it passed. They're XML files, which is why ByteSend reads them for you.",
  },
];

export default function DmarcCheckerPage() {
  if (!isCloud()) notFound();

  return (
    <ToolPage
      current="/tools/dmarc"
      title="DMARC checker"
      intro="Check any domain's DMARC record: whether it's valid, how strict it is, and what to fix next. No sign-up needed."
      checker={<DmarcChecker />}
      explainer={{
        title: "The three policies",
        description: "Most domains should move through them in order.",
        items: [
          { label: "p=none", title: "Monitoring", text: "Nothing is blocked. Mail providers send you reports, so you can see who sends as your domain." },
          { label: "p=quarantine", title: "Quarantine", text: "Mail that fails DMARC goes to spam. A good middle step once your legitimate senders pass." },
          { label: "p=reject", title: "Reject", text: "Mail that fails DMARC is refused outright. The goal: nobody can send as your domain." },
        ],
      }}
      faq={FAQ}
    />
  );
}
