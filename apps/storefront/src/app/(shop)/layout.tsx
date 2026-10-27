import type { ReactNode } from "react";
import { getCategoryOverview, getNavigation } from "@/lib/api";
import { DEFAULT_NAV } from "@/lib/default-nav";
import { pruneDeadCategoryLinks, type PublishedCategorySlugs } from "@/lib/navigation-guard";
import { AnnouncementStrip } from "@/components/announcement-strip";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/bottom-nav";

/** Full storefront chrome for every browsing surface (home, shop, product, cart,
 *  account, wishlist, policies…). The checkout flow uses the focused (checkout)
 *  chrome from the approved Stitch design instead.
 *
 *  Navigation links come from the admin Navigation manager (CMS) — but every
 *  category link is validated against the LIVE catalogue before it renders.
 *  Archiving a category therefore removes its navbar/footer links within
 *  seconds, automatically: no one has to revisit the Navigation manager to
 *  clean up. When the CMS has no header items at all, the curated built-in
 *  menu is pruned by the same rule, so the fallback navbar can never point at
 *  an archived category either. If the catalogue API is unreachable the prune
 *  is skipped (fail-open) — an offline API never empties the chrome. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [overview, navigation] = await Promise.all([getCategoryOverview(), getNavigation()]);

  // The overview's categories ARE the published set (the same list the
  // /category/[slug] route resolves against) — including not-yet-ready ones,
  // whose pages render the honest "coming soon" state instead of a 404.
  // null overview ⇒ catalogue unreachable ⇒ publishedSlugs null ⇒ fail open.
  const publishedSlugs: PublishedCategorySlugs = overview
    ? new Set(overview.categories.map((c) => c.slug))
    : null;

  const pick = (location: "header" | "footer-care" | "footer-legal") =>
    pruneDeadCategoryLinks(
      navigation
        .filter((n) => n.location === location)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((n) => ({ href: n.href, label: n.label })),
      publishedSlugs,
    );

  // Admin-managed navigation wins; the curated default keeps the header complete
  // when the CMS has nothing saved (or everything saved was pruned as dead) —
  // pruned by the same catalogue rule so the fallback respects archives too.
  const cmsHeader = pick("header");
  const headerItems = cmsHeader.length > 0 ? cmsHeader : pruneDeadCategoryLinks(DEFAULT_NAV, publishedSlugs);

  return (
    <>
      <AnnouncementStrip />
      <Header navItems={headerItems} />
      <main className="flex-1">{children}</main>
      <Footer
        categories={(overview?.categories ?? [])
          .filter((c) => c.isReady)
          .map((c) => ({ slug: c.slug, name: c.name }))}
        catalogueUnavailable={!overview}
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
