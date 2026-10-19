"use client";
/**
 * /products — admin catalogue list (includes drafts).
 * GET /admin/catalogue/products (up to 48 rows per the API's admin listing) with
 * SKU / name / category / status / variant count / price range, publish toggle and archive.
 */
import { useState } from "react";
import Link from "next/link";
import { ApiError, apiDelete, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatINR, humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { CategoryDoc, Page, ProductWithVariants } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { productDocToPayload } from "@/components/products/product-form";

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

  return (
    <div>
      <PageHeader
        title="Products"
        description="Full catalogue including drafts and archived items. The storefront only ever sees published products."
        actions={
          canWrite ? (
            <Link href="/products/new">
              <Button>New product</Button>
            </Link>
          ) : null
        }
      />

      <Card>
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error.message} status={error.status} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Create your first product with at least one sellable variant."
            action={
              canWrite ? (
                <Link href="/products/new">
                  <Button size="sm">New product</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH scope="col">SKU</TH>
                  <TH scope="col">Name</TH>
                  <TH scope="col">Category</TH>
                  <TH scope="col">Status</TH>
                  <TH scope="col">Variants</TH>
                  <TH scope="col">Price range</TH>
                  {canWrite ? <TH scope="col">Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {data.items.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs">
                      <Link href={`/products/${p.id}`} className="text-forest hover:underline">
                        {p.sku}
                      </Link>
                      {p.isDemo ? <span className="ml-2 rounded bg-honey/15 px-1 py-0.5 text-[10px] font-semibold text-honey-dark">DEMO</span> : null}
                    </TD>
                    <TD className="max-w-[16rem] truncate font-medium" title={p.name}>
                      <Link href={`/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TD>
                    <TD className="text-ink/70">{categoryName(p.categoryId)}</TD>
                    <TD>
                      <StatusBadge status={p.status} />
                    </TD>
                    <TD>{p.variants.length}</TD>
                    <TD>{priceRange(p)}</TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => togglePublish(p)} disabled={busyId === p.id}>
                            {p.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                          {p.status !== "archived" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:bg-red-50"
                              onClick={() => archive(p)}
                              disabled={busyId === p.id}
                            >
                              Archive
                            </Button>
                          ) : (
                            <span className="text-xs text-ink/40">{humanize("archived")}</span>
                          )}
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
            {data.items.length >= 48 ? (
              <p className="border-t border-sand px-4 py-2 text-xs text-ink/50 sm:px-6">
                Showing the first {data.items.length} products (admin listing cap). Use the API filters for older items.
              </p>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
