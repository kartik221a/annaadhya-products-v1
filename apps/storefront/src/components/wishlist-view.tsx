"use client";
/**
 * Approved-family wishlist template for /wishlist, wired to the real
 * WishlistProvider (device-local saved items) and the live catalogue.
 *
 * Honesty rules encoded here:
 *  - the wishlist lives in this browser's storage — the page says so plainly
 *    and never implies account or cross-device sync, because no wishlist
 *    server exists yet (lib/wishlist.tsx is the documented swap point);
 *  - saved products that have left the catalogue stay visible in a
 *    "No longer listed" strip with a remove action — a saved list is a
 *    deliberate act, so nothing is ever pruned silently;
 *  - when the product API can't be reached, an explicit retry banner appears
 *    instead of pretending the wishlist is empty;
 *  - counts come from the real provider; the empty state links only to the
 *    store's real categories (same shelves as the approved cart template).
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWishlist } from "@/lib/wishlist";
import { PUBLIC_API_URL, type ApiEnvelope } from "@/lib/api";
import type { ProductWithVariantsShape } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import {
  IconAlertTriangle,
  IconCheck,
  IconDroplet,
  IconFlower2,
  IconGift,
  IconHeart,
  IconRefresh,
  IconSprout,
  IconTrash,
} from "@/components/icons";

/** Real category shelves for the empty state — mirrors the approved cart template. */
const EMPTY_SHELVES = [
  { href: "/category/honey", label: "Forest Honeys", icon: IconDroplet },
  { href: "/category/kesar", label: "Kesar", icon: IconFlower2 },
  { href: "/category/dry-fruits", label: "Dry Fruits", icon: IconSprout },
  { href: "/category/gift-boxes", label: "Gift Hampers", icon: IconGift },
] as const;

/** Per-slug resolution — a saved item is ok, gone from the catalogue, or unreachable. */
type ItemState =
  | { kind: "ok"; product: ProductWithVariantsShape }
  | { kind: "missing" }
  | { kind: "error" };

async function fetchItem(slug: string): Promise<ItemState> {
  try {
    const res = await fetch(`${PUBLIC_API_URL}/products/slug/${encodeURIComponent(slug)}`);
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "error" };
    const body = (await res.json()) as ApiEnvelope<ProductWithVariantsShape>;
    return body.ok && body.data ? { kind: "ok", product: body.data } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

/** A slug isn't a display name — prettify it without inventing product data. */
function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Full-page skeleton while the provider boots or the first batch resolves. */
function WishlistSkeleton({ tiles }: { tiles: number }) {
  return (
    <div className="w-full px-margin-mobile py-space-xl lg:px-margin" role="status" aria-live="polite">
      <p className="sr-only">Loading your wishlist…</p>
      <div className="mx-auto max-w-7xl animate-pulse" aria-hidden>
        <div className="h-3 w-40 rounded bg-surface-container-high" />
        <div className="mt-space-md h-9 w-64 rounded-lg bg-surface-container-high" />
        <div className="mt-2 h-3 w-full max-w-md rounded bg-surface-container" />
        <div className="mt-space-xl grid grid-cols-2 gap-space-md lg:grid-cols-4">
          {Array.from({ length: Math.max(1, Math.min(tiles, 8)) }).map((_, i) => (
            <div key={i} className="h-72 rounded-lg bg-surface-container-lowest shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WishlistView() {
  const wishlist = useWishlist();
  const [items, setItems] = useState<Map<string, ItemState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  // Cache of resolved items so hearting one product never refetches the whole list.
  const cacheRef = useRef<Map<string, ItemState>>(new Map());

  const slugKey = wishlist.ready ? wishlist.slugs.join("|") : "";
  const slugs = useMemo(() => (slugKey ? slugKey.split("|") : []), [slugKey]);

  useEffect(() => {
    if (!wishlist.ready) return;
    let cancelled = false;

    // Keep the cache tidy: forget slugs that are no longer saved.
    for (const key of [...cacheRef.current.keys()]) {
      if (!slugs.includes(key)) cacheRef.current.delete(key);
    }
    const pending = slugs.filter((s) => !cacheRef.current.has(s));

    const snapshot = () => {
      setItems(
        new Map(
          slugs
            .map((s) => [s, cacheRef.current.get(s)] as const)
            .filter((pair): pair is [string, ItemState] => pair[1] !== undefined),
        ),
      );
    };

    if (pending.length === 0) {
      snapshot();
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.all(
      pending.map(async (slug) => [slug, await fetchItem(slug)] as const),
    ).then((pairs) => {
      if (cancelled) return;
      for (const [slug, state] of pairs) cacheRef.current.set(slug, state);
      snapshot();
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [wishlist.ready, slugs, attempt]);

  /** Re-check only the items that failed — resolved ones stay untouched. */
  const retry = () => {
    for (const [slug, state] of [...cacheRef.current.entries()]) {
      if (state.kind === "error") cacheRef.current.delete(slug);
    }
    setAttempt((n) => n + 1);
  };

  const okProducts = slugs
    .map((s) => items.get(s))
    .filter((st): st is Extract<ItemState, { kind: "ok" }> => st?.kind === "ok")
    .map((st) => st.product);
  const missingSlugs = slugs.filter((s) => items.get(s)?.kind === "missing");
  const erroredSlugs = slugs.filter((s) => items.get(s)?.kind === "error");
  const unresolvedCount = slugs.length - okProducts.length - missingSlugs.length - erroredSlugs.length;

  /* ------------------------------ boot / load ------------------------------- */

  if (!wishlist.ready || (loading && okProducts.length === 0)) {
    return <WishlistSkeleton tiles={wishlist.slugs.length} />;
  }

  /* -------------------------------- empty ----------------------------------- */

  if (slugs.length === 0) {
    return (
      <div className="w-full bg-surface px-margin-mobile py-space-xl lg:px-margin">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-space-xl py-space-lg text-center">
          {/* Heritage vessel illustration */}
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-surface-container-high/60 shadow-inner">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-surface-container-low">
              <IconHeart size={52} className="text-primary" />
            </div>
            <span className="absolute -bottom-2 rounded-full bg-secondary px-3 py-1 text-[0.625rem] font-bold uppercase tracking-widest text-on-secondary shadow-sm">
              Nothing Saved Yet
            </span>
          </div>

          <div className="max-w-md space-y-space-xs">
            <span className="text-label-sm font-bold uppercase tracking-widest text-outline">
              Your wishlist is currently empty
            </span>
            <h1 className="font-display text-headline-lg-mobile font-semibold text-primary lg:text-headline-lg">
              Nothing Kept for Later
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Tap the heart on any product and it will wait here until you&apos;re ready. Your picks
              are kept on this device — no account needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-space-md">
            <Link
              href="/shop"
              className="btn-primary inline-block rounded-lg px-space-xl py-space-sm text-label-lg uppercase tracking-wider shadow-md"
            >
              Explore the Pantry
            </Link>
            <Link
              href="/about"
              className="inline-block rounded-lg bg-surface-container-low px-space-lg py-space-sm text-label-lg uppercase tracking-wider text-on-surface shadow-sm transition-all hover:bg-surface-container-high"
            >
              Our Story
            </Link>
          </div>

          {/* Quick collection links — real categories only */}
          <div className="mt-space-md grid w-full grid-cols-2 gap-space-md border-t border-outline-variant/30 pt-space-xl sm:grid-cols-4">
            {EMPTY_SHELVES.map((shelf) => (
              <Link
                key={shelf.href}
                href={shelf.href}
                className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-shadow hover:shadow-md"
              >
                <shelf.icon size={24} className="text-primary" />
                <span className="text-label-sm font-bold text-on-surface">{shelf.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------- filled ---------------------------------- */

  return (
    <div className="flex w-full flex-col bg-surface">
      {/* Breadcrumb strip (matches the approved cart template) */}
      <div className="w-full bg-surface-container-low/70 px-margin-mobile py-space-sm lg:px-margin">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-7xl items-center gap-2 text-label-md text-on-surface-variant"
        >
          <Link href="/" className="transition-colors hover:text-primary">
            Home
          </Link>
          <span className="opacity-40" aria-hidden>
            /
          </span>
          <span className="font-semibold text-primary" aria-current="page">
            Your Wishlist
          </span>
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin">
        {/* Editorial header + honest device-local note */}
        <header className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-end">
          <div className="space-y-space-xs">
            <span className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-md py-1 text-label-sm font-semibold uppercase tracking-wider text-primary">
              <IconHeart size={15} />
              {wishlist.count} {wishlist.count === 1 ? "item" : "items"} saved
            </span>
            <h1 className="font-display text-headline-lg-mobile font-semibold tracking-tight text-primary lg:text-headline-lg">
              Your Wishlist
            </h1>
            <p className="max-w-xl text-body-md text-on-surface-variant">
              Keepsakes you&apos;ve hearted from the pantry, ready whenever you are. Move anything
              into the basket straight from its card below.
            </p>
          </div>
          <span
            title="Your wishlist is kept in this browser's storage — it isn't tied to an account yet, so it follows you across visits on this device."
            className="inline-flex w-fit items-center gap-2 rounded-full border border-outline-variant/40 px-space-md py-1.5 text-label-sm text-on-surface-variant"
          >
            <IconCheck size={14} className="text-secondary" />
            Saved on this device
          </span>
        </header>

        {/* Explicit failure banner — never pretend the list is empty */}
        {erroredSlugs.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-space-sm rounded-xl bg-error-container px-space-lg py-space-md text-on-error-container sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <IconAlertTriangle size={20} className="mt-0.5 shrink-0" />
              <p className="text-body-sm">
                We couldn&apos;t check{" "}
                {erroredSlugs.length === slugs.length
                  ? "any"
                  : `${erroredSlugs.length} of ${slugs.length}`}{" "}
                of your saved {erroredSlugs.length === 1 ? "item" : "items"} just now — the store may
                be briefly unreachable. Nothing was removed.
              </p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-on-error-container/30 px-4 py-2 text-label-sm font-semibold uppercase tracking-wider transition-colors hover:bg-error/10"
            >
              <IconRefresh size={15} />
              Try again
            </button>
          </div>
        )}

        {/* Saved products still in the catalogue */}
        {okProducts.length > 0 && (
          <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
            {okProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {unresolvedCount > 0 &&
              Array.from({ length: Math.min(unresolvedCount, 8) }).map((_, i) => (
                <div
                  key={`pending-${i}`}
                  className="h-72 animate-pulse rounded-lg bg-surface-container-lowest shadow-sm"
                  aria-hidden
                />
              ))}
          </div>
        )}

        {/* Saved items that have left the catalogue — visible until removed */}
        {missingSlugs.length > 0 && (
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-lg">
            <h2 className="font-display text-headline-sm text-on-surface">No longer listed</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              These saved items have left the catalogue. They stay on your list until you remove
              them — we never delete your picks silently.
            </p>
            <ul className="mt-space-md flex flex-col gap-2">
              {missingSlugs.map((slug) => (
                <li
                  key={slug}
                  className="flex items-center justify-between gap-space-md rounded-lg bg-surface-container-low px-space-md py-space-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-label-lg font-semibold text-on-surface">
                      {prettifySlug(slug)}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant">
                      Unavailable — removed from the catalogue
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => wishlist.remove(slug)}
                    aria-label={`Remove ${prettifySlug(slug)} from your wishlist`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-sm font-semibold uppercase tracking-wider text-error transition-colors hover:bg-error-container"
                  >
                    <IconTrash size={14} />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
