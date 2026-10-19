"use client";
/** Cart — client cart with server quote validation preview. */
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/format";
import { PUBLIC_API_URL } from "@/lib/api";

interface QuotePreview {
  items: { variantId: string; qty: number }[];
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  unavailable: { variantId: string; reason: string }[];
}

export default function CartPage() {
  const cart = useCart();
  const [quote, setQuote] = useState<QuotePreview | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function validateOnServer() {
    setChecking(true);
    setQuoteError(null);
    try {
      const res = await fetch(`${PUBLIC_API_URL}/checkout/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty })) }),
      });
      const body = (await res.json()) as { ok: boolean; data?: QuotePreview; error?: { message: string } };
      if (body.ok && body.data) {
        setQuote(body.data);
        // Auto-remove items the server says are gone
        for (const u of body.data.unavailable) {
          cart.remove(u.variantId);
        }
      } else {
        setQuoteError(body.error?.message ?? "Could not validate the cart");
      }
    } catch {
      setQuoteError("Could not reach the store server — is the API running?");
    } finally {
      setChecking(false);
    }
  }

  if (!cart.ready) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-ink-soft">Loading your cart…</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-4xl" aria-hidden>🧺</p>
        <h1 className="font-display mt-4 text-3xl font-semibold text-forest">Your basket is empty</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Fill it with floral honeys, crunchy dry fruits or a little saffron for the festive shelf.
        </p>
        <Link href="/shop" className="btn-primary mt-8 inline-block px-7 py-3 text-sm">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-forest">Your basket</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li key={item.variantId} className="card-soft flex gap-4 p-4">
              <img src={item.image ?? "/demo-images/placeholder.svg"} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <div className="flex-1">
                <Link href={`/product/${item.slug}`} className="font-display font-semibold text-ink hover:text-forest">
                  {item.name}
                </Link>
                <p className="text-sm text-ink-soft">{item.packLabel} · {item.sku}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center rounded-full border border-sand bg-white">
                    <button className="px-3 py-1 text-forest" aria-label={`Decrease ${item.name}`} onClick={() => cart.setQty(item.variantId, item.qty - 1)}>−</button>
                    <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                    <button className="px-3 py-1 text-forest" aria-label={`Increase ${item.name}`} onClick={() => cart.setQty(item.variantId, item.qty + 1)}>+</button>
                  </div>
                  <button className="text-xs text-berry hover:underline" onClick={() => cart.remove(item.variantId)}>Remove</button>
                </div>
              </div>
              <p className="font-semibold text-ink">{formatINR(item.unitPricePaise * item.qty)}</p>
            </li>
          ))}
        </ul>

        <aside className="card-soft h-fit p-5" aria-label="Order summary">
          <h2 className="font-display text-lg font-semibold text-ink">Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Items</dt><dd className="font-medium">{formatINR(cart.subtotalPaise)}</dd></div>
            {quote && (
              <>
                <div className="flex justify-between"><dt className="text-ink-soft">Shipping (estimated)</dt><dd className="font-medium">{quote.shippingPaise === 0 ? "Free" : formatINR(quote.shippingPaise)}</dd></div>
                <div className="flex justify-between border-t border-sand pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-display font-semibold text-forest">{formatINR(quote.totalPaise)}</dd></div>
              </>
            )}
          </dl>

          {quoteError && <p className="mt-3 rounded-lg bg-berry/10 p-2.5 text-xs text-berry">{quoteError}</p>}
          {quote && quote.unavailable.length > 0 && (
            <p className="mt-3 rounded-lg bg-berry/10 p-2.5 text-xs text-berry">
              {quote.unavailable.length} item(s) were unavailable and removed from your basket.
            </p>
          )}

          {!quote ? (
            <button className="btn-outline mt-5 w-full py-2.5 text-sm" onClick={validateOnServer} disabled={checking}>
              {checking ? "Checking prices…" : "Check prices & stock"}
            </button>
          ) : (
            <Link
              href={`/checkout?quoteId=${quote.items.length ? "" : ""}`}
              className="btn-primary mt-5 block w-full py-2.5 text-center text-sm"
              onClick={(e) => {
                // Proceed with a fresh quote at checkout time; cart is re-validated server-side anyway.
                if (cart.items.length === 0) e.preventDefault();
              }}
            >
              Proceed to checkout
            </Link>
          )}
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-soft">
            Final totals are always confirmed by the server at checkout — the basket is a shopping intent,
            never the bill.
          </p>
        </aside>
      </div>
    </div>
  );
}
