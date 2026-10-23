"use client";
/**
 * /products — admin catalogue list (includes drafts), wearing the approved
 * Stitch heritage design ("Modern Indian Heritage Editorial") with the same
 * recipes as the Overview dashboard: surface-container cards, maroon display
 * heading, heritage eyebrow, soft-ring table and heritage status badges.
 *
 * Functionality unchanged: GET /admin/catalogue/products (up to 48 rows per the
 * API's admin listing) with SKU / name+image / category / status / variant count
 * / price range, publish toggle and archive — publish + archive stay gated by
 * products:write and re-verified by the API server-side.
 */
import { useState } from "react";
import Link from "next/link";
import { ApiError, apiDelete, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatINR, humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { CategoryDoc, Page, ProductWithVariants } from "@/lib/types";
import { productDocToPayload } from "@/components/products/product-form";

/** The Stitch card recipe used across the console (matches the Overview page). */
const CARD = "rounded-xl bg-surface-container-lowest shadow-[0_1px_8px_rgba(39,24,16,0.04)] ring-1 ring-outline-variant/25";

/** Heritage badge surfaces for the platform's product lifecycle statuses. */
const STATUS_STYLES: Record<string, string> = {
  published: "bg-secondary-container text-on-secondary-container",
  draft: "bg-surface-container-high text-on-surface-variant",
  archived: "bg-error-container text-on-error-container",
};

export default function ProductsPage() {
  usePageTitle("Products");
  const { principal } = useAuth();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  // useApiQuery keeps the latest fetcher in a ref, so a plain closure is fine here.
  const { data, loading, error, reload } = useApiQuery<Page<ProductWithVariants>>(
    () => apiGet<Page<ProductWithVariants>>("/admin/catalogue/products"),
  );
  const { data: categories } = useApiQuery<CategoryDoc[]>(() => apiGet("/admin/catalogue/categories"));

  const canWrite = can(principal, "products:write");
  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? "—";

  async function togglePublish(product: ProductWithVariants) {
    const nextStatus = product.status === "published" ? "draft" : "published";
    setBusyId(product.id);
    try {
      await apiPost(`/admin/catalogue/products/${product.id}`, productDocToPayload(product, nextStatus));
      toast.success(nextStatus === "published" ? "Product published" : "Product unpublished", product.sku);
      reload();
    } catch (err) {
      toast.error("Could not update product", err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  async function archive(product: ProductWithVariants) {
    if (!window.confirm(`Archive ${product.sku} — ${product.name}? Archived products and their variants leave the storefront.`)) return;
    setBusyId(product.id);
    try {
      await apiDelete(`/admin/catalogue/products/${product.id}`);
      toast.success("Product archived", product.sku);
      reload();
    } catch (err) {
      toast.error("Could not archive product", err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  function priceRange(p: ProductWithVariants): string {
    if (p.variants.length === 0) return "—";
    const prices = p.variants.map((v) => v.pricePaise);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
  }

  const ghostBtn =
    "rounded-lg px-2.5 py-1.5 font-label-md text-label-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="font-heritage-sans">
      {/* ------------------------------- header ------------------------------- */}
      <header className="mb-space-lg flex flex-col justify-between gap-space-md pb-space-sm lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-space-xs font-label-sm text-label-sm font-bold uppercase tracking-widest text-secondary">
            <span className="inline-block h-2 w-2 rounded-full bg-secondary" aria-hidden />
            Heritage Produce Console · Catalogue
          </p>
          <h1 className="font-heritage-display text-[28px] leading-9 font-semibold tracking-tight text-primary sm:text-headline-lg sm:leading-12">
            Products
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Full catalogue including drafts and archived items — the storefront only ever sees published products.
          </p>
        </div>
        {canWrite ? (
          <Link
            href="/products/new"
            className="inline-flex h-10 shrink-0 items-center gap-space-xs rounded-lg bg-primary px-space-md font-label-md text-label-md font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New product
          </Link>
        ) : null}
      </header>

      {/* ----------------------------- catalogue card ----------------------------- */}
      <div className={CARD}>
        {loading ? (
          <div className="space-y-4 p-space-md sm:p-space-lg" role="status" aria-label="Loading products">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-space-md">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-surface-container-high" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-container-high" />
                  <div className="h-2.5 w-1/5 animate-pulse rounded bg-surface-container" />
                </div>
                <div className="hidden h-3.5 w-16 animate-pulse rounded bg-surface-container-high sm:block" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="m-space-md flex flex-col items-center justify-center rounded-xl border-l-4 border-error bg-surface-container-lowest px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-heritage-display text-headline-md font-medium text-on-surface">Couldn&rsquo;t load the catalogue</h2>
            <p className="mt-1 max-w-md text-body-sm text-on-surface-variant">
              {error.message}
              {error.status ? ` (HTTP ${error.status})` : ""}
            </p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-container"
            >
              Try again
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-primary" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 7h12l1 13H5L6 7Z" strokeLinejoin="round" />
                <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-heritage-display text-headline-md font-medium text-on-surface">No products yet</h2>
            <p className="mt-1 max-w-md text-body-md text-on-surface-variant">
              Create your first product with at least one sellable variant — it appears on the storefront the moment you publish it.
            </p>
            {canWrite ? (
              <Link
                href="/products/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-container"
              >
                New product
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-left text-body-md">
                <thead className="border-b border-outline-variant/40 bg-surface-container-low/50">
                  <tr>
                    <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Product</th>
                    <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Category</th>
                    <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Status</th>
                    <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Variants</th>
                    <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Price range</th>
                    {canWrite ? (
                      <th scope="col" className="px-space-md py-3 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {data.items.map((p) => {
                    const thumb = p.images[0]?.url;
                    const statusStyle = STATUS_STYLES[p.status] ?? "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant";
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-surface-container-low/60">
                        <td className="px-space-md py-3">
                          <div className="flex items-center gap-space-md">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary/demo hosts; next/image would need remotePatterns per host
                              <img
                                src={thumb}
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 shrink-0 rounded-lg bg-surface-container-low object-cover ring-1 ring-outline-variant/40"
                              />
                            ) : (
                              <span
                                aria-hidden
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high font-heritage-display text-label-lg font-semibold text-primary"
                              >
                                {p.name.charAt(0)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/products/${p.id}`}
                                className="block max-w-[16rem] truncate font-semibold text-on-surface transition-colors hover:text-primary hover:underline"
                                title={p.name}
                              >
                                {p.name}
                              </Link>
                              <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                                <span className="font-mono text-[11px]">{p.sku}</span>
                                {p.isDemo ? (
                                  <span className="rounded-full bg-tertiary-fixed/50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-on-tertiary-fixed-variant">
                                    Demo
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-3 align-middle whitespace-nowrap text-on-surface-variant">{categoryName(p.categoryId)}</td>
                        <td className="px-space-md py-3 align-middle whitespace-nowrap">
                          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-space-sm py-0.5 text-label-sm font-bold ${statusStyle}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                            {humanize(p.status)}
                          </span>
                        </td>
                        <td className="px-space-md py-3 align-middle whitespace-nowrap tabular-nums">{p.variants.length}</td>
                        <td className="px-space-md py-3 align-middle whitespace-nowrap font-medium tabular-nums">{priceRange(p)}</td>
                        {canWrite ? (
                          <td className="px-space-md py-3 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => togglePublish(p)}
                                disabled={busyId === p.id}
                                className={`${ghostBtn} text-primary hover:bg-surface-container-high`}
                              >
                                {p.status === "published" ? "Unpublish" : "Publish"}
                              </button>
                              {p.status !== "archived" ? (
                                <button
                                  type="button"
                                  onClick={() => archive(p)}
                                  disabled={busyId === p.id}
                                  className={`${ghostBtn} text-error hover:bg-error-container/70`}
                                >
                                  Archive
                                </button>
                              ) : (
                                <span className="text-label-sm text-on-surface-variant">{humanize("archived")}</span>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.items.length >= 48 ? (
              <p className="border-t border-outline-variant/30 px-space-md py-3 text-label-sm text-on-surface-variant sm:px-space-lg">
                Showing the first {data.items.length} products (admin listing cap). Use the API filters for older items.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
