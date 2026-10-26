import type { ReactNode } from "react";
import { getCategories, getNavigation } from "@/lib/api";
import { AnnouncementStrip } from "@/components/announcement-strip";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/bottom-nav";

/** Full storefront chrome for every browsing surface (home, shop, product, cart,
 *  account, wishlist, policies…). The checkout flow uses the focused (checkout)
 *  chrome from the approved Stitch design instead.
 *  Navigation links come from the admin Navigation manager (CMS); the curated
 *  built-in links render whenever the CMS has nothing saved for a location. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [categories, navigation] = await Promise.all([getCategories(), getNavigation()]);
  const readyCategories = categories.filter((c) => c.isReady);
  const pick = (location: "header" | "footer-care" | "footer-legal") =>
    navigation
      .filter((n) => n.location === location)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((n) => ({ href: n.href, label: n.label }));

  return (
    <>
      <AnnouncementStrip />
      <Header navItems={pick("header")} />
      <main className="flex-1">{children}</main>
      <Footer
        categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))}
        careLinks={pick("footer-care")}
        legalLinks={pick("footer-legal")}
      />
      {/* Flow spacer matching the fixed BottomNav (nav + safe-area) so the footer's
          last line can never be pinned behind the bar on phones. */}
      <div
        aria-hidden
        className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden"
      />
      <BottomNav />
    </>
  );
}
