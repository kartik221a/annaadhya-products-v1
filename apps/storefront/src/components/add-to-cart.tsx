"use client";
/** Variant selector + quantity + add-to-cart. Variant change updates SKU/price/stock correctly. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { availableQty, formatINR } from "@/lib/format";
import type { ProductWithVariantsShape, ProductVariant } from "@/lib/types";

export function AddToCartPanel({ product }: { product: ProductWithVariantsShape }) {
  const variants = useMemo(
    () => product.variants.filter((v) => v.status === "published"),
    [product.variants],
  );
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useCart();

  const selected: ProductVariant | undefined = variants.find((v) => v.id === selectedId) ?? variants[0];
  const available = selected ? availableQty(selected) : 0;
  const outOfStock = available <= 0;

  function add() {
    if (!selected || outOfStock) return;
    cart.add(
      {
        variantId: selected.id,
        productId: product.id,
        slug: product.slug,
        sku: selected.sku,
        name: product.name,
        packLabel: selected.packLabel,
        image: product.images[0]?.url,
        unitPricePaise: selected.pricePaise,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Choose pack size</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pack size">
          {variants.map((v) => {
            const isSel = v.id === selected?.id;
            const vAvail = availableQty(v);
            return (
              <button
                key={v.id}
                role="radio"
                aria-checked={isSel}
                onClick={() => {
                  setSelectedId(v.id);
                  setQty(1);
                }}
                disabled={vAvail <= 0}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  isSel ? "border-forest bg-forest text-cream" : "border-sand bg-white text-ink hover:border-honey"
                }`}
              >
                {v.packLabel}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="flex items-baseline gap-3">
          <p className="font-display text-3xl font-semibold text-forest">{formatINR(selected.pricePaise)}</p>
          {selected.mrpPaise && selected.mrpPaise > selected.pricePaise && (
            <p className="text-sm text-ink-soft line-through">{formatINR(selected.mrpPaise, false)}</p>
          )}
          <p className="text-sm text-ink-soft">per {selected.packLabel}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-sand bg-white">
          <button
            className="px-3.5 py-2 text-lg text-forest disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
          <button
            className="px-3.5 py-2 text-lg text-forest disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(available || 1, q + 1))}
            aria-label="Increase quantity"
            disabled={outOfStock || qty >= available}
          >
            +
          </button>
        </div>

        <button className="btn-primary px-7 py-2.5 text-sm" onClick={add} disabled={outOfStock}>
          {outOfStock ? "Out of stock" : "Add to cart"}
        </button>

        {added && (
          <Link href="/cart" className="text-sm font-semibold text-forest underline-offset-2 hover:underline">
            Added ✓ — go to cart
          </Link>
        )}
      </div>

      <p className="text-sm" role="status">
        {selected && !outOfStock && available <= (selected.lowStockThreshold ?? 5) && (
          <span className="text-berry">Only {available} left — small batches, ordered fresh.</span>
        )}
        {selected && !outOfStock && available > (selected.lowStockThreshold ?? 5) && (
          <span className="text-ink-soft">In stock and ready to ship.</span>
        )}
      </p>
    </div>
  );
}
