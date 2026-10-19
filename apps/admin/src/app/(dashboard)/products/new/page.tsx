"use client";
/**
 * /products/new — create a product. Dedicated page (the form is large).
 * On success we route to the edit page so the variants can be tuned further.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/lib/hooks";
import type { ProductWithVariants } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import {
  ProductForm,
  emptyProductForm,
  emptyVariantRow,
  type ImageRow,
  type VariantRow,
} from "@/components/products/product-form";

export default function NewProductPage() {
  usePageTitle("New product");
  const router = useRouter();
  const [form, setForm] = useState(emptyProductForm);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([emptyVariantRow()]);
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="New product"
        description="Every product needs a unique SKU and at least one variant to be sellable. New products start as drafts."
      />
      <ProductForm
        mode="create"
        form={form}
        setForm={setForm}
        variantRows={variantRows}
        setVariantRows={setVariantRows}
        imageRows={imageRows}
        setImageRows={setImageRows}
        onSaved={(product: ProductWithVariants) => router.push(`/products/${product.id}`)}
      />
    </div>
  );
}
