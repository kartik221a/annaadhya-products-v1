import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/api";
import { AccountView, type SupportContacts } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "My Account | Annaadhya Products",
  robots: { index: false, follow: false }, // private surface — keep out of search engines
};

/** Server shell: pulls the store's REAL support contacts (public settings) for the
 *  concierge card, then hands off to the client view for session-scoped data. */
export default async function AccountPage() {
  const settings = await getPublicSettings();
  const support: SupportContacts | null = settings
    ? { email: settings.store.supportEmail, phone: settings.store.supportPhone }
    : null;
  return <AccountView support={support} />;
}
