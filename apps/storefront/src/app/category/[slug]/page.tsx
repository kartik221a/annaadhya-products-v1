import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProducts } from "@/lib/api";
import { ProductGrid, ProductCardSkeleton } from "@/components/product-card";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return { title: "Category" };
  return {
    title: `${category.name} — ${category.tagline}`,
    description: category.description.slice(0, 180),
    openGraph: { title: `${category.name} | Annaadhya Products`, description: category.tagline },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const sortParam = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) ?? "relevance";

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const qs = new URLSearchParams({ category: slug, sort: sortParam, pageSize: "24" });
  const result = await getProducts(qs);

  // Not-ready categories are never indexed and clearly labelled.
  if (!category.isReady) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-4xl" aria-hidden>🎁</p>
        <h1 className="font-display mt-4 text-3xl font-semibold text-forest">{category.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{category.description}</p>
        <Link href="/shop" className="btn-primary mt-8 inline-block px-6 py-3 text-sm">
          Browse available products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <section className="border-b border-sand bg-cream-deep/60">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <nav className="mb-4 text-xs text-ink-soft" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-forest">Home</Link>
            <span aria-hidden> / </span>
            <span className="text-ink">{category.name}</span>
          </nav>
          <h1 className="font-display text-3xl font-semibold text-forest md:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-2xl text-[1.02rem] text-ink-soft">{category.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {!result ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : result.items.length === 0 ? (
          <div className="card-soft p-10 text-center">
            <p className="font-display text-xl font-semibold text-ink">This shelf is being restocked</p>
            <p className="mt-2 text-sm text-ink-soft">We list products only after supplier verification — check back soon.</p>
          </div>
        ) : (
          <ProductGrid products={result.items} />
        )}
      </div>
    </div>
  );
}
