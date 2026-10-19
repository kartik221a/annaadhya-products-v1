"use client";
/** Account home — profile, saved addresses, order history. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiGetAuth } from "@/lib/api";
import { formatINR, formatDateIN } from "@/lib/format";
import type { CustomerDoc } from "@/lib/types";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: number;
}

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [profile, setProfile] = useState<CustomerDoc | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.principal) router.push("/account/login");
  }, [auth.loading, auth.principal, router]);

  const load = useCallback(async () => {
    if (!auth.token) return;
    try {
      const me = await apiGetAuth<{ principal: unknown; customer: CustomerDoc | null }>("/auth/me", auth.token);
      setProfile(me.customer);
      const page = await apiGetAuth<{ items: OrderRow[] }>("/orders/mine", auth.token);
      setOrders(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account");
    }
     
  }, [auth.token]);

  useEffect(() => {
    if (auth.principal) void load();
  }, [auth.principal, load]);

  async function saveProfile() {
    if (!auth.token) return;
    try {
      const updated = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/profile`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ displayName: name || undefined, phone: phone || "" }),
      }).then((r) => r.json());
      if (updated.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        await auth.refreshProfile();
      } else {
        setError(updated.error?.message ?? "Could not save profile");
      }
    } catch {
      setError("Could not reach the server");
    }
  }

  if (auth.loading || !auth.principal) {
    return <div className="py-20 text-center text-ink-soft">Loading your account…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">Namaste, {profile?.displayName ?? auth.principal.displayName ?? "friend"} 👋</h1>
          <p className="mt-1 text-sm text-ink-soft">{profile?.email ?? auth.principal.email ?? "Add an email for order updates"}</p>
        </div>
        <button className="btn-outline px-5 py-2 text-sm" onClick={() => void auth.signOut().then(() => router.push("/"))}>Sign out</button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-berry/10 p-3 text-sm text-berry">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <section className="card-soft p-5" aria-labelledby="profile-h">
            <h2 id="profile-h" className="font-display text-lg font-semibold text-ink">Profile</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-medium">Display name
                <input className="input-base mt-1" defaultValue={profile?.displayName} onChange={(e) => setName(e.target.value)} placeholder={profile?.displayName} />
              </label>
              <label className="block text-sm font-medium">Mobile
                <input className="input-base mt-1" defaultValue={profile?.phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
              </label>
              <button className="btn-primary w-full py-2.5 text-sm" onClick={() => void saveProfile()}>
                {saved ? "Saved ✓" : "Save changes"}
              </button>
            </div>
          </section>

          <section className="card-soft p-5" aria-labelledby="addr-h">
            <h2 id="addr-h" className="font-display text-lg font-semibold text-ink">Saved addresses</h2>
            {profile?.addresses?.length ? (
              <ul className="mt-3 space-y-3 text-sm">
                {profile.addresses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-sand p-3">
                    <p className="font-semibold text-ink">{a.fullName} {a.isDefault && <span className="ml-1 rounded bg-honey px-1.5 text-[0.65rem] font-bold">DEFAULT</span>}</p>
                    <p className="mt-1 text-ink-soft">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
                    <p className="text-ink-soft">📞 {a.phone}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No saved addresses yet — add one during checkout.</p>
            )}
          </section>

          <section className="card-soft p-5" aria-labelledby="danger-h">
            <h2 id="danger-h" className="font-display text-lg font-semibold text-ink">Account controls</h2>
            <button
              className="mt-3 text-sm font-medium text-berry underline"
              onClick={() => {
                if (confirm("Request account deletion? Support will contact you to confirm.")) {
                  void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/me`, { method: "DELETE", headers: { authorization: `Bearer ${auth.token}` } });
                }
              }}
            >
              Request account deletion
            </button>
            <p className="mt-2 text-xs text-ink-soft">Deletion is completed after a verification step per our privacy policy.</p>
          </section>
        </div>

        <section aria-labelledby="orders-h">
          <h2 id="orders-h" className="font-display text-xl font-semibold text-ink">Order history</h2>
          {!orders ? (
            <p className="mt-4 text-sm text-ink-soft">Loading orders…</p>
          ) : orders.length === 0 ? (
            <div className="card-soft mt-4 p-8 text-center">
              <p className="text-sm text-ink-soft">No orders yet — your first jar of honey awaits.</p>
              <Link href="/shop" className="btn-primary mt-4 inline-block px-6 py-2.5 text-sm">Browse products</Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} className="card-soft flex items-center justify-between p-4 transition-colors hover:border-honey">
                    <div>
                      <p className="font-semibold text-ink">{o.orderNumber}</p>
                      <p className="text-xs text-ink-soft">{formatDateIN(o.createdAt)} · {o.status.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-forest">{formatINR(o.totalPaise)}</p>
                      <p className="text-xs text-ink-soft">{o.paymentStatus}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
