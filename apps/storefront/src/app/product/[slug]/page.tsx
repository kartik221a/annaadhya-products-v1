import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getRelatedProducts } from "@/lib/api";
import { ProductGrid } from "@/components/product-card";
import { AddToCartPanel } from "@/components/add-to-cart";
import { availableQty, formatINR } from "@/lib/format";

export const revalidate = 45;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.seo?.title ?? `${product.name} — ${product.subtitle}`,
    description: product.seo?.description ?? product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.subtitle,
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(slug);
  const variants = product.variants.filter((v) => v.status === "published");
  const cheapest = variants.length ? Math.min(...variants.map((v) => v.pricePaise)) : 0;
  const inStock = variants.some((v) => availableQty(v) > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    brand: { "@type": "Brand", name: "Annaadhya Products" },
    image: product.images.map((i) => i.url),
    ...(variants.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: (cheapest / 100).toFixed(2),
        highPrice: (Math.max(...variants.map((v) => v.pricePaise)) / 100).toFixed(2),
        offerCount: variants.length,
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    }),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-xs text-ink-soft" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-forest">Home</Link>
        <span aria-hidden> / </span>
        <Link href="/shop" className="hover:text-forest">Shop</Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="card-soft overflow-hidden">
            <img
              src={product.images[0]?.url ?? "/demo-images/placeholder.svg"}
              alt={product.images[0]?.alt || product.name}
              className="aspect-square w-full object-cover"
            />
          </div>
          <p className="mt-2 text-center text-[0.7rem] text-ink-soft">
            Demo imagery — replaced with real product photography before launch.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-honey-deep">{product.typeLabel}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight text-ink md:text-4xl">{product.name}</h1>
          <p className="mt-2 text-[1.02rem] text-ink-soft">{product.subtitle}</p>

          <div className="mt-7">
            <AddToCartPanel product={product} />
          </div>

          <div className="motif-divider my-8" aria-hidden />

          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="font-display text-lg font-semibold text-ink">About this product</h2>
            <p className="mt-2 whitespace-pre-line text-[0.94rem] leading-relaxed text-ink-soft">{product.description}</p>
          </section>

          {(product.ingredients || product.storageInstructions || product.allergenInfo || product.netQuantityLabel) && (
            <section className="mt-8" aria-labelledby="label-heading">
              <h2 id="label-heading" className="font-display text-lg font-semibold text-ink">Product details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {product.netQuantityLabel && (
                  <div className="flex gap-2"><dt className="font-semibold text-ink">Net quantity:</dt><dd className="text-ink-soft">{product.netQuantityLabel}</dd></div>
                )}
                {product.ingredients && (
                  <div className="flex gap-2"><dt className="font-semibold text-ink">Ingredients:</dt><dd className="text-ink-soft">{product.ingredients}</dd></div>
                )}
                {product.storageInstructions && (
                  <div className="flex gap-2"><dt className="font-semibold text-ink">Storage:</dt><dd className="text-ink-soft">{product.storageInstructions}</dd></div>
                )}
                {product.allergenInfo && (
                  <div className="flex gap-2"><dt className="font-semibold text-ink">Allergens:</dt><dd className="text-ink-soft">{product.allergenInfo}</dd></div>
                )}
              </dl>
            </section>
          )}

          <section className="mt-8" aria-labelledby="variants-heading">
            <h2 id="variants-heading" className="font-display text-lg font-semibold text-ink">Pack sizes &amp; prices</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2">Pack</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Availability</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-sand/70">
                    <td className="py-2 font-medium text-ink">{v.packLabel}</td>
                    <td className="py-2">{formatINR(v.pricePaise)}</td>
                    <td className="py-2 text-ink-soft">{availableQty(v) > 0 ? "In stock" : "Out of stock"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-display text-2xl font-semibold text-ink">You may also like</h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
