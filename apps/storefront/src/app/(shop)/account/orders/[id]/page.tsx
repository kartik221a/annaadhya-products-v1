"use client";
/** Order detail — status tracking, line-item snapshot, totals. */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiGetAuth } from "@/lib/api";
import { formatINR, formatDateIN } from "@/lib/format";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string;
  totalPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  refundPaise: number;
  createdAt: number;
  items: { sku: string; name: string; variantLabel: string; qty: number; unitPricePaise: number; lineTotalPaise: number; image?: string }[];
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  tracking?: { carrier: string; trackingNumber: string };
}

const STEPS = ["pending_payment", "confirmed", "processing", "shipped", "delivered"];

export default function OrderDetailPage() {
  const auth = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.principal) router.push("/account/login");
  }, [auth.loading, auth.principal, router]);

  useEffect(() => {
    if (!auth.token || !params?.id) return;
    apiGetAuth<OrderDetail>(`/orders/mine/${params.id}`, auth.token)
      .then(setOrder)
      .catch((e: Error) => setError(e.message));
  }, [auth.token, params?.id]);

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-berry">{error}</div>;
  }
  if (!order) return <div className="py-20 text-center text-ink-soft">Loading order…</div>;

  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account/orders" className="text-sm text-forest hover:underline">← Back to order history</Link>
      <h1 className="font-display mt-3 text-3xl font-semibold text-forest">{order.orderNumber}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Placed {formatDateIN(order.createdAt)} · Payment {order.paymentStatus.replace(/_/g, " ")} via {order.paymentProvider}
      </p>

      {order.status !== "cancelled" && order.status !== "refunded" && (
        <ol className="mt-7 flex items-center" aria-label="Order progress">
          {STEPS.slice(1).map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${stepIndex > i ? "border-forest bg-forest text-cream" : "border-sand bg-white text-ink-soft"}`}>
                  {stepIndex > i ? "✓" : i + 1}
                </span>
                <span className="mt-1 text-[0.65rem] capitalize text-ink-soft">{s.replace(/_/g, " ")}</span>
              </div>
              {i < 3 && <div className={`mx-1 h-0.5 flex-1 ${stepIndex > i + 1 ? "bg-forest" : "bg-sand"}`} aria-hidden />}
            </li>
          ))}
        </ol>
      )}

      {order.tracking && (
        <p className="card-soft mt-6 p-4 text-sm">
          <strong className="text-ink">Tracking:</strong> {order.tracking.carrier} — <span className="font-mono">{order.tracking.trackingNumber}</span>
        </p>
      )}

      <section className="card-soft mt-6 p-5" aria-labelledby="items-h">
        <h2 id="items-h" className="font-display text-lg font-semibold text-ink">Items</h2>
        <ul className="mt-3 divide-y divide-sand">
          {order.items.map((item) => (
            <li key={item.sku} className="flex items-center gap-4 py-3">
              <img src={item.image ?? "/demo-images/placeholder.svg"} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-soft">{item.variantLabel} · {item.sku} · qty {item.qty}</p>
              </div>
              <p className="font-semibold">{formatINR(item.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-sand pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Shipping</dt><dd>{order.shippingPaise === 0 ? "Free" : formatINR(order.shippingPaise)}</dd></div>
          {order.refundPaise > 0 && <div className="flex justify-between text-berry"><dt>Refunded</dt><dd>-{formatINR(order.refundPaise)}</dd></div>}
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="font-display text-forest">{formatINR(order.totalPaise)}</dd></div>
        </dl>
      </section>

      <section className="card-soft mt-6 p-5 text-sm" aria-labelledby="ship-h">
        <h2 id="ship-h" className="font-display text-lg font-semibold text-ink">Delivery address</h2>
        <p className="mt-2 text-ink-soft">
          <strong className="text-ink">{order.shippingAddress.fullName}</strong><br />
          {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}<br />
          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
        </p>
      </section>
    </div>
  );
}
