"use client";
/** Checkout status — success / pending / failure states driven by query params + live payment polling. */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PUBLIC_API_URL } from "@/lib/api";

interface AttemptStatus {
  status: string;
  order: { orderNumber: string; status: string; paymentStatus: string } | null;
}

function StatusInner() {
  const sp = useSearchParams();
  const result = sp.get("result") ?? "pending";
  const orderNumber = sp.get("order");
  const [live, setLive] = useState<AttemptStatus | null>(null);

  useEffect(() => {
    const attemptId = sp.get("attemptId");
    if (!attemptId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${PUBLIC_API_URL}/payments/${attemptId}/status`);
        const body = (await res.json()) as { ok: boolean; data?: AttemptStatus };
        if (body.ok && body.data) {
          setLive(body.data);
          if (body.data.status === "succeeded") clearInterval(timer);
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [sp]);

  const success = result === "success" || live?.status === "succeeded";

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>{success ? "🎉" : result === "failure" ? "😔" : "⏳"}</p>
      <h1 className="font-display mt-5 text-3xl font-semibold text-forest">
        {success ? "Order confirmed" : result === "failure" ? "Payment didn't go through" : "Order received"}
      </h1>
      {orderNumber && <p className="mt-2 font-mono text-sm text-ink-soft">Order {orderNumber}</p>}
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
        {success
          ? "Thank you! Your order is confirmed. A confirmation email follows once dispatch begins — you can also track it from your account."
          : result === "failure"
            ? "The payment attempt failed or was cancelled. Your basket items were reserved briefly and released — nothing was charged. You can retry checkout anytime."
            : "We're waiting for the payment gateway to confirm. This page updates automatically — you can also check your account orders."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders" className="btn-primary px-6 py-2.5 text-sm">View my orders</Link>
        <Link href="/shop" className="btn-outline px-6 py-2.5 text-sm">Continue shopping</Link>
      </div>
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink-soft">Loading…</div>}>
      <StatusInner />
    </Suspense>
  );
}
