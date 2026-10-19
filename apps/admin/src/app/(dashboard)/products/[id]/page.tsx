"use client";
/**
 * /products/[id] — edit a product. Loads GET /admin/catalogue/products/:id
 * (ProductWithVariants), prefills the shared form, supports the archive action.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, apiDelete, apiGet, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import type { ProductWithVariants } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  ProductForm,
  docImagesToRows,
  docVariantsToRows,
  emptyProductForm,
  emptyVariantRow,
  productDocToForm,
  type ImageRow,
  type VariantRow,
} from "@/components/products/product-form";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id ?? "";
  const router = useRouter();
  const toast = useToast();
  const { principal } = useAuth();
  const canWrite = can(principal, "products:write");
  usePageTitle("Edit product");

  const [form, setForm] = useState(emptyProductForm);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const { data, loading, error, reload } = useApiQuery<ProductWithVariants>(
    () => apiGet<ProductWithVariants>(`/admin/catalogue/products/${productId}`),
    [productId],
  );

  // Hydrate the editable state once per loaded product (not on every keystroke).
  if (data && hydratedId !== data.id) {
    setHydratedId(data.id);
    setForm(productDocToForm(data));
    setVariantRows(data.variants.length > 0 ? docVariantsToRows(data) : [emptyVariantRow()]);
    setImageRows(docImagesToRows(data));
  }

  async function archive() {
    if (!data) return;
    if (!window.confirm(`Archive ${data.sku} — ${data.name}? Archived products and their variants leave the storefront.`)) return;
    setArchiving(true);
    try {
      await apiDelete(`/admin/catalogue/products/${data.id}`);
      toast.success("Product archived", data.sku);
      router.push("/products");
    } catch (err) {
      toast.error("Could not archive product", err instanceof ApiError ? err.message : "Unexpected error");
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <TableSkeleton rows={10} cols={4} />
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <ErrorState message={error?.message ?? "Product not found"} status={error?.status} onRetry={reload} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={data.name}
        description={
          <>
            <span className="font-mono text-xs">{data.sku}</span> · {data.variants.length} variant
            {data.variants.length === 1 ? "" : "s"}
            {data.isDemo ? " · demo record" : ""}
          </>
        }
        actions={
          <>
            <Link href="/products">
              <Button variant="outline">Back to list</Button>
            </Link>
            {canWrite && data.status !== "archived" ? (
              <Button variant="outline" className="text-red-700" onClick={archive} loading={archiving}>
                Archive
              </Button>
            ) : null}
          </>
        }
      />
      {canWrite ? (
        <ProductForm
          mode="edit"
          productId={data.id}
          form={form}
          setForm={setForm}
          variantRows={variantRows}
          setVariantRows={setVariantRows}
          imageRows={imageRows}
          setImageRows={setImageRows}
          onSaved={() => {
            setHydratedId(null); // re-hydrate from the fresh doc on next render
            reload();
          }}
        />
      ) : (
        <Card className="p-6 text-sm text-ink/70">
          You have <strong>products:read</strong> only — the edit form is hidden. Ask an owner for <strong>products:write</strong> to make changes.
        </Card>
      )}
    </div>
  );
}
