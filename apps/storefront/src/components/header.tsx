"use client";
/** Announcement strip + header with search, nav, cart badge and account menu. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Logo } from "./logo";

export function AnnouncementStrip({ message, href }: { message: string; href?: string }) {
  return (
    <div className="bg-forest text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[0.8rem]">
        <span aria-hidden>✻</span>
        {href ? (
          <Link href={href} className="underline-offset-2 hover:underline">
            {message}
          </Link>
        ) : (
          <span>{message}</span>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { href: "/shop", label: "Shop all" },
  { href: "/category/honey", label: "Honey" },
  { href: "/category/dry-fruits", label: "Dry fruits" },
  { href: "/category/kesar", label: "Kesar" },
];

export function Header() {
  const { count, ready } = useCart();
  const { principal, signOut } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(query.trim() ? `/shop?search=${encodeURIComponent(query.trim())}` : "/shop");
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-sand bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <button
          className="rounded-md p-2 text-forest md:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <Logo />

        <nav className="ml-6 hidden items-center gap-6 md:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[0.9rem] font-medium text-ink transition-colors hover:text-forest">
              {n.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden w-56 lg:block" role="search">
          <input
            className="input-base py-1.5 text-sm"
            placeholder="Search honey, kesar…"
            aria-label="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <div className="ml-auto flex items-center gap-1 lg:ml-3">
          <Link
            href="/cart"
            className="relative rounded-full p-2.5 text-forest transition-colors hover:bg-cream-deep"
            aria-label={`Cart${ready && count > 0 ? ` (${count} items)` : ""}`}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 7h12l-1.2 11a2 2 0 01-2 1.8H9.2a2 2 0 01-2-1.8L6 7z" />
              <path d="M9 10V6a3 3 0 016 0v4" strokeLinecap="round" />
            </svg>
            {ready && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-honey px-1 text-[0.68rem] font-bold text-ink">
                {count}
              </span>
            )}
          </Link>

          {principal ? (
            <div className="relative">
              <Link
                href="/account"
                className="rounded-full p-2.5 text-forest transition-colors hover:bg-cream-deep"
                aria-label="Account"
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.4" />
                  <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" />
                </svg>
              </Link>
            </div>
          ) : (
            <Link href="/account/login" className="btn-primary px-4 py-1.5 text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-sand bg-cream px-4 py-3 md:hidden" aria-label="Mobile">
          <form onSubmit={submitSearch} className="mb-3" role="search">
            <input
              className="input-base"
              placeholder="Search products…"
              aria-label="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream-deep" onClick={() => setMenuOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              {principal ? (
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left font-medium text-berry hover:bg-cream-deep"
                  onClick={() => {
                    void signOut();
                    setMenuOpen(false);
                  }}
                >
                  Sign out ({principal.displayName ?? "account"})
                </button>
              ) : (
                <Link href="/account/login" className="block rounded-lg px-3 py-2 font-medium text-forest hover:bg-cream-deep" onClick={() => setMenuOpen(false)}>
                  Sign in / Register
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
