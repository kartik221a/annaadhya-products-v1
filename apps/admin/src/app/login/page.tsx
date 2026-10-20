"use client";
/**
 * /login — admin sign-in.
 *
 * Firebase mode (API reports mode.authentication === "firebase"): email/password + Google
 * sign-in via the Firebase JS SDK; the ID token is exchanged at POST /auth/verify and stored
 * as the session bearer token. If the account has no staff record yet, the page shows the
 * account UID so the very first owner can bootstrap themselves (POST /auth/bootstrap-owner,
 * guarded by ADMIN_SETUP_KEY) and sign in again.
 *
 * Mock mode (non-production): POST /auth/dev/token form, unchanged.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isFirebaseClientConfigured } from "@/lib/firebase";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";

function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) {
    return "Incorrect email or password.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts — wait a moment and try again.";
  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized for sign-in — add it under Firebase Console → Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "This sign-in provider is not enabled — turn it on under Firebase Console → Authentication → Sign-in method.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Google sign-in was cancelled.";
  }
  if (code === "auth/network-request-failed") return "Network error — check your connection.";
  return err instanceof Error ? err.message : "Sign-in failed — try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { principal, ready, mode, loginDev, loginFirebaseEmail, loginFirebaseGoogle, refreshMode } =
    useAuth();
  const [uid, setUid] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState<string | null>(null); // holds the UID

  // Already signed in as staff → straight to the console.
  useEffect(() => {
    if (ready && principal?.isStaff) router.replace("/dashboard");
  }, [ready, principal, router]);

  // Surface the platform auth mode up-front so the correct form renders before the first attempt.
  useEffect(() => {
    void refreshMode();
  }, [refreshMode]);

  const firebaseMode = mode?.authentication === "firebase";
  const firebaseClientReady = isFirebaseClientConfigured();

  async function onFirebaseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const authPrincipal = await loginFirebaseEmail(email, password);
      if (!authPrincipal.isStaff) {
        setNeedsBootstrap(authPrincipal.uid);
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setFormError(firebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleSubmit() {
    setFormError(null);
    setSubmitting(true);
    try {
      const authPrincipal = await loginFirebaseGoogle();
      if (!authPrincipal.isStaff) {
        setNeedsBootstrap(authPrincipal.uid);
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setFormError(firebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDevSubmit(e: React.FormEvent) {
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

        {needsBootstrap ? (
          <Card className="border-honey/40">
            <CardBody className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">Signed in — no staff record yet</h2>
              <p className="text-sm text-ink/70">
                This Firebase account is not on the team registry. The <strong>first owner</strong> can
                provision themselves with the one-time bootstrap endpoint.
              </p>
              <div className="rounded-md bg-cream p-3 text-sm text-ink/80">
                <p className="mb-1 font-medium">Your account UID:</p>
                <code className="block break-all rounded bg-sand/60 px-2 py-1 text-xs">{needsBootstrap}</code>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
                <li>
                  Open <code className="rounded bg-sand/60 px-1 py-0.5 text-xs">/api/docs</code> →{" "}
                  <code className="rounded bg-sand/60 px-1 py-0.5 text-xs">POST /auth/bootstrap-owner</code>
                </li>
                <li>
                  Body: <code className="break-all rounded bg-sand/60 px-1 py-0.5 text-xs">
                    {`{ "setupKey": "<ADMIN_SETUP_KEY>", "uid": "${needsBootstrap}", "displayName": "Owner", "email": "<your email>" }`}
                  </code>
                </li>
                <li>Come back here and sign in again.</li>
              </ol>
              <Button variant="outline" size="sm" onClick={() => setNeedsBootstrap(null)}>
                Back to sign-in
              </Button>
            </CardBody>
          </Card>
        ) : firebaseMode && firebaseClientReady ? (
          <Card>
            <CardBody className="p-6">
              <form onSubmit={onFirebaseSubmit} className="space-y-4" noValidate>
                <p className="text-sm text-ink/60">
                  Sign in with your Firebase account. Roles and permissions are resolved server-side from
                  the staff registry — this form never grants access by itself.
                </p>
                <Field label="Email" htmlFor="fb-email" required>
                  <Input
                    id="fb-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field label="Password" htmlFor="fb-password" required>
                  <Input
                    id="fb-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Field>

                {formError ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {formError}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" loading={submitting} disabled={!email.trim() || !password}>
                  Sign in
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-xs text-ink/40">
                <span className="h-px flex-1 bg-sand" />or<span className="h-px flex-1 bg-sand" />
              </div>

              <Button variant="outline" className="w-full" onClick={() => void onGoogleSubmit()} disabled={submitting}>
                Sign in with Google
              </Button>

              <div className="mt-4 border-t border-sand pt-3 text-xs text-ink/50">
                Platform mode: <strong>Firebase authentication</strong>. Sessions are verified server-side on
                every request.
              </div>
            </CardBody>
          </Card>
        ) : firebaseMode ? (
          <Card className="border-honey/40">
            <CardBody className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">Firebase client config missing</h2>
              <p className="text-sm text-ink/70">
                The API uses Firebase authentication, but this admin build has no{" "}
                <code className="rounded bg-sand/60 px-1 py-0.5 text-xs">NEXT_PUBLIC_FIREBASE_*</code>{" "}
                variables, so the panel cannot open a Firebase sign-in.
              </p>
              <p className="rounded-md bg-cream p-3 text-sm text-ink/80">
                Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_APP_ID on the admin service and
                redeploy — they are inlined at build time.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-6">
              <form onSubmit={onDevSubmit} className="space-y-4" noValidate>
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
                {firebaseMode ? (
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
