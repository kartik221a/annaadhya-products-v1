import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/api";
import { FaqExplorer } from "./faq-explorer";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Honest answers about ordering, shipping, payments, products, returns and gifting at Annaadhya Products — matching our published policies.",
  openGraph: {
    title: "FAQ | Annaadhya Products",
    description:
      "Ordering, shipping, payments, returns and gifting — answered plainly, matching our published policies.",
    type: "website",
    siteName: "Annaadhya Products",
  },
};

export default async function FaqPage() {
  const settings = await getPublicSettings();

  // Truth discipline (same rule as the contact + account pages): a `.example`
  // address is the seeded placeholder — it is never rendered as a real channel.
  const candidate = settings?.store.supportEmail?.trim() ?? "";
  const supportEmail = candidate && !/\.example$/i.test(candidate) ? candidate : null;

  return <FaqExplorer supportEmail={supportEmail} />;
}
