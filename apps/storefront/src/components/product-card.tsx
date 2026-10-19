import Link from "next/link";
import { formatINR, minVariantPricePaise, availableQty } from "@/lib/format";
import type { ProductWithVariantsShape } from "@/lib/types";

export function ProductCard({ product }: { product: ProductWithVariantsShape }) {
  const variants = product.variants.filter((v) => v.status === "published");
  if (variants.length === 0) return null;
  const from = minVariantPricePaise(variants);
  const image = product.images[0]?.url ?? "/demo-images/placeholder.svg";
  const soldOut = variants.every((v) => availableQty(v) <= 0);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="card-soft group flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-deep">
        {/* Demo SVG placeholders are replaceable; Cloudinary photography drops into the same field. */}
        <img
          src={image}
          alt={product.images[0]?.alt || product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-cream">
            Out of stock
          </span>
        ) : product.bestsellerRank ? (
          <span className="absolute left-3 top-3 rounded-full bg-honey px-3 py-1 text-xs font-semibold text-ink">
            Bestseller
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-honey-deep">{product.typeLabel}</p>
        <h3 className="font-display mt-1 text-[1.02rem] font-semibold leading-snug text-ink">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-[0.83rem] leading-relaxed text-ink-soft">{product.subtitle}</p>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-ink">
            <span className="text-[0.7rem] text-ink-soft">From </span>
            <span className="font-semibold">{formatINR(from, false)}</span>
          </p>
          <span className="text-xs font-medium text-forest underline-offset-2 group-hover:underline">View →</span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductWithVariantsShape[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      <div className="aspect-square animate-pulse bg-cream-deep" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-cream-deep" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-cream-deep" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-cream-deep" />
      </div>
    </div>
  );
}
