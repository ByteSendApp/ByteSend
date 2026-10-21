import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "~/components/marketing/tools/tool-page";
import { isCloud } from "~/utils/common";
import { DkimChecker } from "./dkim-checker";

export const metadata: Metadata = {
  title: "Free DKIM checker – ByteSend",
  description: "Find a domain's DKIM keys and check them: key size, revoked or test-mode keys, and broken records.",
  alternates: { canonical: "https://bytesend.cloud/tools/dkim" },
};

const FAQ = [
  {
    q: "What is DKIM?",
    a: "A signature added to every email you send, checked against a public key in your DNS. It proves the message came from you and wasn't changed on the way.",
  },
  {
    q: "What's a selector?",
    a: "The name your DKIM key is published under, at <selector>._domainkey.yourdomain.com. Each provider uses its own, so a domain can have several keys. You can find it in the s= tag of the DKIM-Signature header on an email you've sent.",
  },
  {
    q: "How long should my key be?",
    a: "2048 bits. 1024-bit keys still work but are considered weak, and anything shorter is ignored by many providers.",
  },
  {
    q: "Which selector does ByteSend use?",
    a: "bytesend, or bytesend-<region> if you've moved a domain to another sending region. The domain page in your dashboard shows the exact record.",
  },
];

export default function DkimCheckerPage() {
  if (!isCloud()) notFound();

  return (
    <ToolPage
      current="/tools/dkim"
      title="DKIM checker"
      intro="Find a domain's DKIM keys and check them: how strong they are, and whether any are revoked, in test mode or broken. Leave the selector empty and we'll try the common ones."
      checker={<DkimChecker />}
      faq={FAQ}
    />
  );
}
