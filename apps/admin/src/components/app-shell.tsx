"use client";
/**
 * AppShell — the guarded dashboard chrome: sidebar (desktop) / hamburger drawer (mobile),
 * top bar with account + sign-out, sticky footer pushed with mt-auto.
 *
 * Guard rule: redirect to /login when there is no session or the principal is not staff.
 * Nav items the principal's permissions lack are hidden (server still enforces everything).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS } from "./nav-items";
import { humanize } from "@/lib/format";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { principal } = useAuth();
  const permissions = principal?.permissions ?? [];

  const visible = NAV_ITEMS.filter((item) =>
    item.anyOf ? item.anyOf.some((p) => permissions.includes(p)) : permissions.includes(item.permission),
  );

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-0.5">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-forest text-cream" : "text-ink/75 hover:bg-sand/50 hover:text-ink"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
      {visible.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink/50">No sections available for your role.</p>
      ) : null}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
      <img src="/logo.svg" alt="" width={32} height={32} className="rounded" />
      <span className="font-display text-lg font-semibold tracking-tight text-forest">Annaadhya Admin</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { principal, ready, logout } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Guard: no session or not staff → /login. (Client-side; the API re-checks every request.)
  useEffect(() => {
    if (ready && (!principal || !principal.isStaff)) router.replace("/login");
  }, [ready, principal, router]);

  // While restoring the session, avoid flashing the console.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink/50">Restoring session…</p>
      </div>
    );
  }

  if (!principal || !principal.isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink/50">Redirecting to sign-in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-sand bg-cream/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-label="Toggle navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-sand/60"
        >
          {drawerOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </header>

      {drawerOpen ? (
        <div className="border-b border-sand bg-white px-3 py-2 md:hidden">
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
        </div>
      ) : null}

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sand bg-white px-3 py-4 md:flex">
          <div className="px-2 pb-4">
            <Brand />
          </div>
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
            <NavLinks />
          </div>
          <div className="border-t border-sand px-2 pt-3">
            <p className="truncate text-sm font-semibold text-ink">{principal.displayName ?? principal.uid}</p>
            <p className="truncate text-xs text-ink/50">{principal.email ?? principal.uid}</p>
            <p className="mt-0.5 text-xs font-medium text-honey-dark">{humanize(principal.role)}</p>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hidden items-center justify-between border-b border-sand bg-white/70 px-6 py-3 backdrop-blur md:flex">
            <p className="text-sm text-ink/60">
              {principal.isStaff ? "Staff console" : "Console"} · sandbox data stays clearly labelled
            </p>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="inline-flex h-10 items-center rounded-md border border-sand bg-white px-3 text-sm font-medium text-ink hover:bg-cream"
            >
              Sign out
            </button>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

          <footer className="mt-auto border-t border-sand bg-white/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
              <p>Annaadhya Products — admin console. Amounts shown in ₹ (stored as integer paise).</p>
              <p>
                Signed in as {principal.displayName ?? principal.uid} · {humanize(principal.role)}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
