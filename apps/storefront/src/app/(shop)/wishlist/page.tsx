"use client";
/** Saved items — renders the client wishlist from localStorage with live product data.
 *  Deliberately small: the wishlist is a new feature added with the homepage redesign. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWishlist } from "@/lib/wishlist";
import { PUBLIC_API_URL, type ApiEnvelope } from "@/lib/api";
import type { ProductWithVariantsShape } from "@/lib/types";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { IconHeart } from "@/components/icons";

async function fetchProduct(slug: string): Promise<ProductWithVariantsShape | null> {
  try {
    const res = await fetch(`${PUBLIC_API_URL}/products/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<ProductWithVariantsShape>;
    return body.ok ? body.data ?? null : null;
  } catch {
    return null;
  }
}

export default function WishlistPage() {
  const wishlist = useWishlist();
  const [products, setProducts] = useState<ProductWithVariantsShape[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wishlist.ready) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results = await Promise.all(
        wishlist.slugs.map(async (slug) => {
          try {
            return await fetchProduct(slug);
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setProducts(results.filter((p): p is ProductWithVariantsShape => p !== null));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [wishlist.ready, wishlist.slugs]);

  return (
    <div className="mx-auto max-w-6xl px-gutter-mobile lg:px-margin py-space-lg lg:py-space-xl">
      <p className="text-label-md uppercase tracking-[0.2em] text-primary">Saved for later</p>
      <h1 className="font-display text-headline-lg-mobile lg:text-headline-lg text-on-surface mt-space-xs mb-space-lg">
        Your Wishlist
      </h1>

      {!wishlist.ready || loading ? (
        wishlist.slugs.length > 0 ? (
          <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
            {wishlist.slugs.slice(0, 4).map((slug) => (
              <ProductCardSkeleton key={slug} />
            ))}
          </div>
        ) : null
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="card-soft flex flex-col items-center gap-space-md p-space-xl text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-primary-container">
            <IconHeart size={26} />
          </span>
          <div>
            <h2 className="font-display text-headline-sm text-on-surface">Nothing saved yet</h2>
            <p className="mt-space-xs text-body-sm text-on-surface-variant">
              Tap the heart on any product to keep it here for later.
            </p>
          </div>
          <Link href="/shop" className="btn-primary px-6 py-2.5 text-label-lg">
            Browse the catalogue
          </Link>
        </div>
      )}
    </div>
  );
}
