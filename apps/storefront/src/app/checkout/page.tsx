"use client";
/** Checkout — guest & signed-in; server quote → order creation → payment (mock simulate or Razorpay notes). */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { PUBLIC_API_URL } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Quote {
  quoteId: string;
  items: { variantId: string; qty: number; unitPricePaise: number; lineTotalPaise: number }[];
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  unavailable: { variantId: string; reason: string }[];
}

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Other",
];

export default function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "Uttar Pradesh",
    pincode: "",
    acceptTerms: false,
  });

  // Prefill from the customer profile when signed in
  useEffect(() => {
    if (auth.customer) {
      setForm((f) => ({
        ...f,
        displayName: auth.customer?.displayName ?? f.displayName,
        email: auth.customer?.email ?? "",
        phone: auth.customer?.phone ?? "",
        ...(auth.customer?.addresses.find((a) => a.isDefault) ?? auth.customer?.addresses[0] ?? {}),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.customer?.id]);

  async function requestQuote(): Promise<Quote> {
    const res = await fetch(`${PUBLIC_API_URL}/checkout/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        pincode: form.pincode || undefined,
      }),
    });
    const body = (await res.json()) as { ok: boolean; data?: Quote; error?: { message: string } };
    if (!body.ok || !body.data) throw new Error(body.error?.message ?? "Could not price your basket");
    return body.data;
  }

  // Re-quote on entry
  useEffect(() => {
    if (cart.ready && cart.items.length > 0 && !quote) {
      requestQuote()
        .then(setQuote)
        .catch((e: Error) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const freshQuote = await requestQuote();
      if (freshQuote.unavailable.length > 0) {
        setError("Some items just went out of stock — they've been highlighted in your basket.");
        setQuote(freshQuote);
        return;
      }
      const res = await fetch(`${PUBLIC_API_URL}/checkout/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({
          quoteId: freshQuote.quoteId,
          paymentMethod: "gateway",
          customer: { displayName: form.displayName, email: form.email, phone: form.phone },
          address: {
            label: "Home",
            fullName: form.displayName,
            phone: form.phone,
            line1: form.line1,
            line2: form.line2 || "",
            city: form.city,
            state: form.state,
            pincode: form.pincode,
          },
          acceptTerms: true,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { order: { id: string; orderNumber: string }; payment: Record<string, unknown> | null };
        error?: { message: string };
      };
      if (!body.ok || !body.data) throw new Error(body.error?.message ?? "Order failed");

      const { order, payment } = body.data;

      // Mock-mode simulate flow (development only). Razorpay checkout.js loads here when configured.
      if (payment && (payment as { provider?: string }).provider === "mock") {
        const confirmRes = await fetch(`${PUBLIC_API_URL}/payments/mock/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptId: (payment as { attemptId: string }).attemptId, outcome: "succeeded" }),
        });
        const confirmBody = (await confirmRes.json()) as { ok: boolean; error?: { message: string } };
        cart.clear();
        router.push(`/checkout/status?order=${order.orderNumber}&result=${confirmBody.ok ? "success" : "pending"}`);
        return;
      }

      cart.clear();
      router.push(`/checkout/status?order=${order.orderNumber}&result=pending`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (cart.ready && cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-forest">Nothing to check out</h1>
        <Link href="/shop" className="btn-primary mt-6 inline-block px-6 py-2.5 text-sm">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-forest">Checkout</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {auth.principal ? `Signed in as ${auth.principal.displayName ?? auth.principal.uid}` : "Checking out as guest — you can sign in from your account page anytime."}
      </p>

      <form onSubmit={placeOrder} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card-soft p-5" aria-labelledby="contact-h">
            <h2 id="contact-h" className="font-display text-lg font-semibold text-ink">Contact</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Full name
                <input required className="input-base mt-1" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoComplete="name" />
              </label>
              <label className="text-sm font-medium">Mobile number
                <input required className="input-base mt-1" placeholder="10-digit mobile" inputMode="numeric" pattern="(\+91[\s-]?)?[6-9]\d{9}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">Email (for order updates)
                <input className="input-base mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
              </label>
            </div>
          </section>

          <section className="card-soft p-5" aria-labelledby="address-h">
            <h2 id="address-h" className="font-display text-lg font-semibold text-ink">Delivery address</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">Address line 1
                <input required className="input-base mt-1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} autoComplete="address-line1" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">Address line 2 (optional)
                <input className="input-base mt-1" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} autoComplete="address-line2" />
              </label>
              <label className="text-sm font-medium">City
                <input required className="input-base mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
              </label>
              <label className="text-sm font-medium">State
                <select className="input-base mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Pincode
                <input required className="input-base mt-1" inputMode="numeric" pattern="\d{6}" title="6-digit pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} autoComplete="postal-code" />
              </label>
            </div>
          </section>

          <section className="card-soft p-5" aria-labelledby="payment-h">
            <h2 id="payment-h" className="font-display text-lg font-semibold text-ink">Payment</h2>
            <p className="mt-2 rounded-lg bg-honey/10 p-3 text-xs leading-relaxed text-ink">
              Demo mode: orders complete through the <strong>mock payment gateway</strong> (no real money
              moves). Razorpay test mode activates automatically once API keys are configured — see
              docs/environment-setup.md.
            </p>
          </section>

          <label className="flex items-start gap-2.5 text-sm">
            <input required type="checkbox" className="mt-0.5" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
            <span className="text-ink-soft">
              I agree to the <Link className="text-forest underline" href="/policies/terms">Terms</Link>,{" "}
              <Link className="text-forest underline" href="/policies/returns">returns &amp; refunds</Link> and{" "}
              <Link className="text-forest underline" href="/policies/privacy">privacy policy</Link>.
            </span>
          </label>
        </div>

        <aside className="card-soft h-fit p-5" aria-label="Order summary">
          <h2 className="font-display text-lg font-semibold text-ink">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.variantId} className="flex justify-between gap-3">
                <span className="text-ink-soft">{i.name} · {i.packLabel} × {i.qty}</span>
                <span className="font-medium">{formatINR(i.unitPricePaise * i.qty)}</span>
              </li>
            ))}
          </ul>
          {quote && (
            <dl className="mt-4 space-y-2 border-t border-sand pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatINR(quote.subtotalPaise)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{quote.shippingPaise === 0 ? "Free" : formatINR(quote.shippingPaise)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="font-display text-forest">{formatINR(quote.totalPaise)}</dd></div>
            </dl>
          )}
          {error && <p className="mt-3 rounded-lg bg-berry/10 p-2.5 text-xs text-berry" role="alert">{error}</p>}
          <button type="submit" className="btn-primary mt-5 w-full py-3 text-sm" disabled={!quote || busy}>
            {busy ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-3 text-[0.7rem] text-ink-soft">Totals are server-calculated in integer paise — the browser never sets the price.</p>
        </aside>
      </form>
    </div>
  );
}
