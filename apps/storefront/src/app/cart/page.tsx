import type { Metadata } from "next";
import { getBestsellers, getPublicSettings } from "@/lib/api";
import { CartView } from "@/components/cart-view";

/** The cart is a private shopping intent, not a catalogue page — keep it out of search. */
export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  // One parallel fan-out: the public shipping policy (powers the honest free-shipping
  // progress card) and real bestseller candidates for the cross-sell row.
  const [settings, bestsellers] = await Promise.all([getPublicSettings(), getBestsellers()]);

  return (
    <CartView
      shipping={settings?.shipping ?? null}
      crossSell={bestsellers.slice(0, 6)}
    />
  );
}
