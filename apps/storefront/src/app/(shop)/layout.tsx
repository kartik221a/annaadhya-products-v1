import type { ReactNode } from "react";
import { getCategories } from "@/lib/api";
import { AnnouncementStrip } from "@/components/announcement-strip";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/bottom-nav";

/** Full storefront chrome for every browsing surface (home, shop, product, cart,
 *  account, wishlist, policies…). The checkout flow uses the focused (checkout)
 *  chrome from the approved Stitch design instead. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const categories = await getCategories();
  const readyCategories = categories.filter((c) => c.isReady);

  return (
    <>
      <AnnouncementStrip />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))} />
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
