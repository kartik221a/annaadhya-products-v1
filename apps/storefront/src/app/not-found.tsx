import type { Metadata } from "next";
import { getCategories } from "@/lib/api";
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
  const categories = await getCategories();
  const readyCategories = categories.filter((c) => c.isReady);

  return (
    <>
      <AnnouncementStrip />
      <Header />
      <main className="flex-1">
        <NotFoundView />
      </main>
      <Footer categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))} />
    </>
  );
}
