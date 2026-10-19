"use client";
/**
 * /login — dev-mode sign-in for the admin panel.
 *
 * In mock-mode the API issues HMAC dev tokens (POST /auth/dev/token). When the API has
 * Firebase configured (or is running in production) that endpoint refuses with 403/503 and
 * we show an honest setup notice instead of a form that can never succeed.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { principal, ready, loginDev, mode, refreshMode } = useAuth();
  const [uid, setUid] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Already signed in as staff → straight to the console.
  useEffect(() => {
    if (ready && principal?.isStaff) router.replace("/dashboard");
  }, [ready, principal, router]);

  // Surface the platform auth mode up-front so the notice is honest before the first attempt.
  useEffect(() => {
    void refreshMode();
  }, [refreshMode]);

  const firebaseConfigured = mode?.authentication === "firebase";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBlocked(null);
    setSubmitting(true);
    try {
      const authPrincipal = await loginDev({ uid, displayName, email });
      if (!authPrincipal.isStaff) {
        setFormError(
          `Signed in as "${authPrincipal.role}" — this account has no staff record. Ask an owner to invite you from Team, or use a staff UID.`,
        );
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403 || err.status === 503 || err.code === "service_unconfigured") {
          setBlocked(err.message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Unexpected error — try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, next/image adds nothing here */}
          <img src="/logo.svg" alt="Annaadhya logo" width={56} height={56} className="rounded-lg" />
          <h1 className="font-display text-2xl font-semibold text-ink">Annaadhya Admin</h1>
          <p className="text-sm text-ink/60">Operations console for the Annaadhya Products storefront.</p>
        </div>

        {blocked ? (
          <Card className="border-honey/40">
            <CardBody className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">Developer sign-in unavailable</h2>
              <p className="text-sm text-ink/70">This API has real authentication configured — dev tokens are refused.</p>
              <p className="rounded-md bg-cream p-3 text-sm text-ink/80">
                Firebase auth is configured — use Firebase sign-in; admin sign-in via Firebase ID token is documented
                in <code className="rounded bg-sand/60 px-1 py-0.5 text-xs">docs/environment-setup.md</code>.
              </p>
              <p className="text-xs text-ink/50">API said: {blocked}</p>
              <Button variant="outline" size="sm" onClick={() => setBlocked(null)}>
                Back to sign-in
              </Button>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-6">
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <p className="text-sm text-ink/60">
                  Sign in with a staff UID. In mock-mode the API mints a dev session for development — the server
                  resolves your role and permissions from the staff registry, never from this form.
                </p>
                <Field label="User ID (UID)" htmlFor="uid" required>
                  <Input
                    id="uid"
                    name="uid"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="e.g. dev-owner-01"
                    autoComplete="username"
                    minLength={4}
                    required
                  />
                </Field>
                <Field label="Display name" htmlFor="displayName">
                  <Input
                    id="displayName"
                    name="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How your name appears in audit logs"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@annaadhya.example"
                    autoComplete="email"
                  />
                </Field>

                {formError ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {formError}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" loading={submitting} disabled={!uid.trim()}>
                  Sign in
                </Button>
              </form>

              <div className="mt-4 border-t border-sand pt-3 text-xs text-ink/50">
                {firebaseConfigured ? (
                  <span>
                    Platform mode: <strong>Firebase authentication</strong>. Dev tokens are disabled on this server.
                  </span>
                ) : (
                  <span>
                    Platform mode: <strong>mock dev tokens</strong> (non-production). Sessions last 12 hours and live
                    in sessionStorage only.
                  </span>
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </main>
  );
}
