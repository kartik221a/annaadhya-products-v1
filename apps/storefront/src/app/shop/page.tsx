import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts } from "@/lib/api";
import { ProductGrid, ProductCardSkeleton } from "@/components/product-card";
import { ShopFilters } from "@/components/shop-filters";

export const metadata: Metadata = {
  title: "Shop all — honey, dry fruits & kesar",
  description: "Browse the full Annaadhya catalogue: floral honeys, everyday dry fruits and small-batch saffron.",
};

interface ShopProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 12;

export default async function ShopPage({ searchParams }: ShopProps) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const params = new URLSearchParams();
  const search = pick("search");
  const category = pick("category");
  const sort = pick("sort") ?? "relevance";
  const min = pick("min");
  const max = pick("max");
  const page = Math.max(1, Number(pick("page") ?? "1") || 1);

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (min) params.set("minPricePaise", String(Math.round(Number(min) * 100)));
  if (max) params.set("maxPricePaise", String(Math.round(Number(max) * 100)));
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const [result, categories] = await Promise.all([getProducts(params), getCategories()]);
  const readyCategories = categories.filter((c) => c.isReady);

  function pageHref(p: number): string {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/shop?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-forest">
          {search ? `Results for “${search}”` : "Shop all"}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {result ? `${result.total} product${result.total === 1 ? "" : "s"}` : "Loading the shelves…"}
        </p>
      </header>

      <ShopFilters categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))} current={{ search, category, sort, min, max }} />

      <div className="mt-8">
        {!result ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : result.items.length === 0 ? (
          <div className="card-soft p-10 text-center">
            <p className="font-display text-xl font-semibold text-ink">Nothing matched those filters</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              Try a broader search, remove the price range, or browse a category — our catalogue is small
              and curated, so a little browsing goes a long way.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/shop" className="btn-primary px-6 py-2.5 text-sm">Clear filters</Link>
              {readyCategories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}`} className="btn-outline px-5 py-2.5 text-sm">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ProductGrid products={result.items} />
            {result.totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="btn-outline px-4 py-2 text-sm">← Previous</Link>
                )}
                <span className="px-3 text-sm text-ink-soft">
                  Page {result.page} of {result.totalPages}
                </span>
                {page < result.totalPages && (
                  <Link href={pageHref(page + 1)} className="btn-outline px-4 py-2 text-sm">Next →</Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
