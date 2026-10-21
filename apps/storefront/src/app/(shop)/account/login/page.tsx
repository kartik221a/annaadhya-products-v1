"use client";
/** Account sign-in — Firebase (Google/email/phone) when configured; honest dev sign-in in mock mode. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

type Tab = "signin" | "register" | "phone";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", otp: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState({ uid: "", displayName: "", email: "" });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.push("/account");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest">Welcome to Annaadhya</h1>
      <p className="mt-2 text-sm text-ink-soft">Sign in to track orders, save addresses and check out faster.</p>

      {auth.firebaseReady ? (
        <>
          <div className="mt-6 flex gap-2" role="tablist" aria-label="Sign-in method">
            {([["signin", "Sign in"], ["register", "Register"], ["phone", "Phone OTP"]] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium ${tab === id ? "bg-forest text-cream" : "bg-cream-deep text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="card-soft mt-5 space-y-4 p-5">
            {error && <p className="rounded-lg bg-berry/10 p-2.5 text-xs text-berry" role="alert">{error}</p>}

            {tab === "signin" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => auth.signInEmail(form.email, form.password));
                }}
              >
                <input className="input-base" type="email" required placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="input-base" type="password" required placeholder="Password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button className="btn-primary w-full py-2.5 text-sm" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
              </form>
            )}

            {tab === "register" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => auth.registerEmail(form.name, form.email, form.password));
                }}
              >
                <input className="input-base" required placeholder="Full name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="input-base" type="email" required placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="input-base" type="password" required minLength={8} placeholder="Password (8+ characters)" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button className="btn-primary w-full py-2.5 text-sm" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
              </form>
            )}

            {tab === "phone" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => auth.signInPhone(form.otp));
                }}
              >
                <div className="flex gap-2">
                  <input className="input-base" required placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <button
                    type="button"
                    className="btn-outline px-4 py-2 text-sm"
                    disabled={busy || !form.phone}
                    onClick={() => void run(() => auth.startPhone(form.phone, "recaptcha-container"))}
                  >
                    Send OTP
                  </button>
                </div>
                <input className="input-base" inputMode="numeric" placeholder="6-digit OTP" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value })} disabled={!auth.phoneConfirmationPending} />
                <button className="btn-primary w-full py-2.5 text-sm" disabled={busy || !auth.phoneConfirmationPending}>Verify &amp; sign in</button>
                <div id="recaptcha-container" />
                <p className="text-[0.7rem] text-ink-soft">Phone OTP uses Firebase; SMS delivery charges apply per provider pricing.</p>
              </form>
            )}

            <div className="relative text-center"><span className="text-xs text-ink-soft">or</span></div>
            <button
              className="btn-outline w-full py-2.5 text-sm"
              disabled={busy}
              onClick={() => void run(auth.signInGoogle)}
            >
              Continue with Google
            </button>
          </div>
        </>
      ) : (
        <div className="card-soft mt-6 space-y-4 p-5">
          <p className="rounded-lg bg-honey/15 p-3 text-xs leading-relaxed text-ink">
            <strong>Demo mode:</strong> Firebase isn&apos;t configured yet, so sign-in uses local development
            identities against the API&apos;s dev-token endpoint. Production sign-in (Google, email/password,
            phone OTP) activates automatically once Firebase env vars are set — see docs/environment-setup.md.
          </p>
          {error && <p className="rounded-lg bg-berry/10 p-2.5 text-xs text-berry" role="alert">{error}</p>}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => auth.devSignIn(dev.uid || `customer-${Date.now().toString(36)}`, dev.displayName || "Demo Customer", dev.email || undefined));
            }}
          >
            <input className="input-base" placeholder="Display name" value={dev.displayName} onChange={(e) => setDev({ ...dev, displayName: e.target.value })} />
            <input className="input-base" type="email" placeholder="Email (optional)" value={dev.email} onChange={(e) => setDev({ ...dev, email: e.target.value })} />
            <input className="input-base" placeholder="User id (any stable string)" value={dev.uid} onChange={(e) => setDev({ ...dev, uid: e.target.value })} />
            <button className="btn-primary w-full py-2.5 text-sm" disabled={busy}>{busy ? "Signing in…" : "Continue (demo)"}</button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink-soft">
        By continuing you agree to our{" "}
        <Link className="underline" href="/policies/terms">Terms</Link> and{" "}
        <Link className="underline" href="/policies/privacy">Privacy policy</Link>.
      </p>
    </div>
  );
}
