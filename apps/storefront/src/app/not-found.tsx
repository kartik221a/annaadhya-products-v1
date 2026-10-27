import type { Metadata } from "next";
import { getCategoryOverview } from "@/lib/api";
import { DEFAULT_NAV } from "@/lib/default-nav";
import { pruneDeadCategoryLinks } from "@/lib/navigation-guard";
import { AnnouncementStrip } from "@/components/announcement-strip";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { NotFoundView } from "@/components/not-found-view";

/** Private error surface — keep every 404 out of search indexes. */
export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

/**
 * Root not-found boundary — serves COMPLETELY UNMATCHED URLs (no route match
 * at all). Next.js does not apply the (shop) group layout here, so the
 * storefront chrome is composed from the SAME shared components used by the
 * (shop) layout — exactly one AnnouncementStrip, one Header, one Footer —
 * around the approved 404 design. Thrown notFound() inside (shop) routes
 * keeps using the group's own boundary with the group layout.
 */
export default async function GlobalNotFound() {
  // Same catalogue rule as the (shop) layout: the overview IS the published set.
  // null ⇒ API unreachable ⇒ footer falls back to its curated offline column and
  // the navbar keeps its unpruned default (fail-open — never empty the chrome).
  const overview = await getCategoryOverview();
  const readyCategories = (overview?.categories ?? []).filter((c) => c.isReady);
  const publishedSlugs = overview ? new Set(overview.categories.map((c) => c.slug)) : null;

  return (
    <>
      <AnnouncementStrip />
      {/* The root boundary sits outside the (shop) layout, so the curated default
          is pruned here too — a dead category link must not greet a 404 visitor. */}
      <Header navItems={pruneDeadCategoryLinks(DEFAULT_NAV, publishedSlugs)} />
      <main className="flex-1">
        <NotFoundView />
      </main>
      <Footer
        categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))}
        catalogueUnavailable={!overview}
      />
    </>
  );
}
