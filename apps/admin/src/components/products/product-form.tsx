"use client";
/**
 * ProductForm — shared create/edit form for products, including the variants editor.
 * Money rules: price/MRP inputs are typed in RUPEES and converted once at submit with
 * Math.round(rupees * 100). SKU conflicts (409) from the API are surfaced inline.
 */
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { productUpsertSchema, zodErrorList } from "@/lib/schemas";
import { useToast } from "@/lib/toast";
import type { CategoryDoc, ProductStatus, ProductUpsertPayload, ProductWithVariants, VariantUpsertPayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { MediaUploader } from "@/components/products/media-uploader";

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9\-_.]{2,40}$/;

/** Load the category list for the select — admin endpoint first, public endpoint as fallback. */
export function useCategories(currentCategoryId?: string): { categories: CategoryDoc[]; loading: boolean; error: string | null } {
  const { principal } = useAuth();
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let rows: CategoryDoc[];
        if (principal && can(principal, "categories:read")) {
          rows = await apiGet<CategoryDoc[]>("/admin/catalogue/categories");
        } else {
          // Roles without categories:read fall back to the public (published + ready) list.
          rows = await apiGet<CategoryDoc[]>("/categories");
        }
        if (!cancelled) setCategories(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load categories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [principal]);

  // Keep the currently selected category selectable even if the fallback list omits it.
  const merged = useMemo(() => {
    if (!currentCategoryId || categories.some((c) => c.id === currentCategoryId)) return categories;
    return [
      ...categories,
      {
        id: currentCategoryId,
        slug: "current",
        name: `Current category (${currentCategoryId})`,
        tagline: "",
        description: "",
        sortOrder: 0,
        isReady: false,
        status: "draft" as ProductStatus,
        createdAt: 0,
        updatedAt: 0,
        isDemo: false,
      },
    ];
  }, [categories, currentCategoryId]);

  return { categories: merged, loading, error };
}

interface VariantRow {
  key: string;
  id?: string;
  sku: string;
  packLabel: string;
  grams: string;
  price: string; // rupees
  mrp: string; // rupees, "" = not set
  status: ProductStatus;
  stockOnHand: string;
  lowStockThreshold: string;
}

interface ImageRow {
  key: string;
  url: string;
  alt: string;
  /** Present when the image came through the Cloudinary media flow — kept for provenance. */
  cloudinaryPublicId?: string;
  width?: number;
  height?: number;
}

export type { VariantRow };
export type { ImageRow };

export interface ProductFormState {
  sku: string;
  name: string;
  subtitle: string;
  description: string;
  categoryId: string;
  typeLabel: string;
  status: ProductStatus;
  giftItem: boolean;
  bestsellerRank: string;
  featuredRank: string;
  seoTitle: string;
  seoDescription: string;
  ingredients: string;
  netQuantityLabel: string;
  storageInstructions: string;
  allergenInfo: string;
  manufacturerDetails: string;
  fssaiLicense: string;
}

export function emptyProductForm(): ProductFormState {
  return {
    sku: "",
    name: "",
    subtitle: "",
    description: "",
    categoryId: "",
    typeLabel: "",
    status: "draft",
    giftItem: false,
    bestsellerRank: "",
    featuredRank: "",
    seoTitle: "",
    seoDescription: "",
    ingredients: "",
    netQuantityLabel: "",
    storageInstructions: "",
    allergenInfo: "",
    manufacturerDetails: "",
    fssaiLicense: "",
  };
}

export function productDocToForm(doc: ProductWithVariants): ProductFormState {
  return {
    sku: doc.sku,
    name: doc.name,
    subtitle: doc.subtitle ?? "",
    description: doc.description ?? "",
    categoryId: doc.categoryId,
    typeLabel: doc.typeLabel ?? "",
    status: doc.status,
    giftItem: doc.giftItem,
    bestsellerRank: doc.bestsellerRank !== undefined ? String(doc.bestsellerRank) : "",
    featuredRank: doc.featuredRank !== undefined ? String(doc.featuredRank) : "",
    seoTitle: doc.seo?.title ?? "",
    seoDescription: doc.seo?.description ?? "",
    ingredients: doc.ingredients ?? "",
    netQuantityLabel: doc.netQuantityLabel ?? "",
    storageInstructions: doc.storageInstructions ?? "",
    allergenInfo: doc.allergenInfo ?? "",
    manufacturerDetails: doc.manufacturerDetails ?? "",
    fssaiLicense: doc.fssaiLicense ?? "",
  };
}

export function emptyVariantRow(): VariantRow {
  return {
    key: `v${Math.random().toString(36).slice(2, 9)}`,
    sku: "",
    packLabel: "",
    grams: "",
    price: "",
    mrp: "",
    status: "published",
    stockOnHand: "0",
    lowStockThreshold: "5",
  };
}

/** Variants of an existing doc as editable rows (paise → rupee inputs). */
export function docVariantsToRows(doc: ProductWithVariants): VariantRow[] {
  return doc.variants.map((v) => ({
    key: v.id,
    id: v.id,
    sku: v.sku,
    packLabel: v.packLabel,
    grams: String(v.grams),
    price: paiseToRupeeInput(v.pricePaise),
    mrp: v.mrpPaise !== undefined ? paiseToRupeeInput(v.mrpPaise) : "",
    status: v.status,
    stockOnHand: String(v.stockOnHand),
    lowStockThreshold: String(v.lowStockThreshold),
  }));
}

/** Rows of an existing doc's images as editable rows. */
export function docImagesToRows(doc: ProductWithVariants): ImageRow[] {
  return (doc.images ?? []).map((img, i) => ({
    key: `img${i}`,
    url: img.url,
    alt: img.alt ?? "",
    ...(img.cloudinaryPublicId ? { cloudinaryPublicId: img.cloudinaryPublicId } : {}),
    ...(img.width ? { width: img.width } : {}),
    ...(img.height ? { height: img.height } : {}),
  }));
}

export function emptyImageRow(): ImageRow {
  return { key: `i${Math.random().toString(36).slice(2, 9)}`, url: "", alt: "" };
}

/** Build the upsert payload straight from a fetched doc (used by the quick publish toggle). */
export function productDocToPayload(doc: ProductWithVariants, statusOverride?: ProductStatus): ProductUpsertPayload {
  return {
    sku: doc.sku,
    name: doc.name,
    subtitle: doc.subtitle,
    description: doc.description,
    categoryId: doc.categoryId,
    typeLabel: doc.typeLabel,
    status: statusOverride ?? doc.status,
    images: doc.images ?? [],
    ingredients: doc.ingredients,
    netQuantityLabel: doc.netQuantityLabel,
    storageInstructions: doc.storageInstructions,
    allergenInfo: doc.allergenInfo,
    manufacturerDetails: doc.manufacturerDetails,
    fssaiLicense: doc.fssaiLicense,
    bestsellerRank: doc.bestsellerRank,
    featuredRank: doc.featuredRank,
    giftItem: doc.giftItem,
    seo: { title: doc.seo?.title, description: doc.seo?.description },
    variants: doc.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      packLabel: v.packLabel,
      grams: v.grams,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      status: v.status,
      stockOnHand: v.stockOnHand,
      lowStockThreshold: v.lowStockThreshold,
    })),
  };
}

function optionalRank(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : NaN;
}

export function useProductSubmit() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(
    form: ProductFormState,
    variantRows: VariantRow[],
    imageRows: ImageRow[],
    mode: "create" | "edit",
    productId?: string,
  ): Promise<ProductWithVariants | null> {
    setServerError(null);
    setSkuError(null);
    setErrors([]);

    // ---- client-side validation (mirrors productUpsertSchema) ----
    const problems: string[] = [];
    if (!SKU_PATTERN.test(form.sku.trim())) problems.push("SKU must be 3-41 chars: A-Z, 0-9, dashes (may not start with a dash).");
    if (form.name.trim().length < 2) problems.push("Name must be at least 2 characters.");
    if (form.description.trim().length < 10) problems.push("Description must be at least 10 characters.");
    if (!form.categoryId) problems.push("Pick a category.");
    const bestsellerRank = optionalRank(form.bestsellerRank);
    const featuredRank = optionalRank(form.featuredRank);
    if (Number.isNaN(bestsellerRank) || (bestsellerRank !== undefined && (bestsellerRank < 1 || bestsellerRank > 1000)))
      problems.push("Bestseller rank must be an integer between 1 and 1000.");
    if (Number.isNaN(featuredRank) || (featuredRank !== undefined && (featuredRank < 1 || featuredRank > 1000)))
      problems.push("Featured rank must be an integer between 1 and 1000.");

    const variants: VariantUpsertPayload[] = [];
    variantRows.forEach((row, idx) => {
      const label = `Variant ${idx + 1} (${row.sku || "no SKU"})`;
      if (!SKU_PATTERN.test(row.sku.trim())) problems.push(`${label}: SKU must be 3-41 chars: A-Z, 0-9, dashes.`);
      if (row.packLabel.trim().length < 1) problems.push(`${label}: pack label is required.`);
      const grams = Number(row.grams);
      if (!Number.isFinite(grams) || grams <= 0) problems.push(`${label}: grams must be a positive number.`);
      const pricePaise = rupeesToPaise(row.price);
      if (Number.isNaN(pricePaise) || pricePaise <= 0) problems.push(`${label}: selling price must be greater than ₹0.`);
      let mrpPaise: number | undefined;
      if (row.mrp.trim() !== "") {
        mrpPaise = rupeesToPaise(row.mrp);
        if (Number.isNaN(mrpPaise)) problems.push(`${label}: MRP is not a valid amount.`);
      }
      const stock = Number(row.stockOnHand || "0");
      if (!Number.isInteger(stock) || stock < 0) problems.push(`${label}: stock on hand must be a whole number ≥ 0.`);
      const threshold = Number(row.lowStockThreshold || "0");
      if (!Number.isInteger(threshold) || threshold < 0) problems.push(`${label}: low-stock threshold must be a whole number ≥ 0.`);

      variants.push({
        id: row.id,
        sku: row.sku.trim().toUpperCase(),
        packLabel: row.packLabel.trim(),
        grams,
        pricePaise,
        mrpPaise,
        status: row.status,
        stockOnHand: stock,
        lowStockThreshold: threshold,
      });
    });

    if (problems.length > 0) {
      setErrors(problems);
      return null;
    }

    const payload: ProductUpsertPayload = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      typeLabel: form.typeLabel.trim(),
      status: form.status,
      images: imageRows
        .filter((img) => img.url.trim() !== "")
        .map((img) => ({
          url: img.url.trim(),
          alt: img.alt.trim(),
          ...(img.cloudinaryPublicId ? { cloudinaryPublicId: img.cloudinaryPublicId } : {}),
          ...(img.width ? { width: img.width } : {}),
          ...(img.height ? { height: img.height } : {}),
        })),
      ingredients: form.ingredients.trim() || undefined,
      netQuantityLabel: form.netQuantityLabel.trim() || undefined,
      storageInstructions: form.storageInstructions.trim() || undefined,
      allergenInfo: form.allergenInfo.trim() || undefined,
      manufacturerDetails: form.manufacturerDetails.trim() || undefined,
      fssaiLicense: form.fssaiLicense.trim() || undefined,
      bestsellerRank,
      featuredRank,
      giftItem: form.giftItem,
      seo: {
        title: form.seoTitle.trim() || undefined,
        description: form.seoDescription.trim() || undefined,
      },
      variants,
    };

    // Final gate with the client-side zod mirror of productUpsertSchema — same rules as the API.
    const parsed = productUpsertSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(zodErrorList(parsed.error));
      return null;
    }

    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await apiPost<ProductWithVariants>("/admin/catalogue/products", payload)
          : await apiPost<ProductWithVariants>(`/admin/catalogue/products/${productId}`, payload);
      toast.success(mode === "create" ? "Product created" : "Product saved", `${saved.sku} — ${saved.name}`);
      return saved;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "conflict") {
          setSkuError(err.message);
          setErrors([err.message]);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Unexpected error while saving.");
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { submit, saving, serverError, skuError, errors, setErrors };
}

/* ------------------------------- form component ------------------------------ */

export function ProductForm({
  mode,
  productId,
  form,
  setForm,
  variantRows,
  setVariantRows,
  imageRows,
  setImageRows,
  onSaved,
}: {
  mode: "create" | "edit";
  productId?: string;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  variantRows: VariantRow[];
  setVariantRows: React.Dispatch<React.SetStateAction<VariantRow[]>>;
  imageRows: ImageRow[];
  setImageRows: React.Dispatch<React.SetStateAction<ImageRow[]>>;
  onSaved?: (product: ProductWithVariants) => void;
}) {
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories(
    mode === "edit" ? form.categoryId : undefined,
  );
  const { submit, saving, serverError, skuError, errors } = useProductSubmit();

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const saved = await submit(form, variantRows, imageRows, mode, productId);
    if (saved) onSaved?.(saved);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {serverError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {serverError}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul role="alert" className="list-inside list-disc rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {/* Identity */}
      <section className="rounded-lg border border-sand bg-white p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Identity</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="SKU" required error={skuError ?? undefined} hint="3-41 chars: A-Z, 0-9, dashes, dots, underscores">
            <Input value={form.sku} onChange={(e) => update("sku", e.target.value.toUpperCase())} placeholder="AN-HNY-001" required />
          </Field>
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Wild Forest Honey" required />
          </Field>
          <Field label="Subtitle" className="md:col-span-2" hint="Short line under the title on the storefront">
            <Input value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} maxLength={180} />
          </Field>
          <Field label="Description" required className="md:col-span-2" hint="At least 10 characters">
            <Textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={5}
              maxLength={8000}
              required
            />
          </Field>
          <Field label="Category" required error={categoriesError ?? undefined}>
            <Select value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
              <option value="">{categoriesLoading ? "Loading categories…" : "Select a category"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type label" hint='Variety / type, e.g. "Wild forest / multifloral honey"'>
            <Input value={form.typeLabel} onChange={(e) => update("typeLabel", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value as ProductStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Checkbox
              label="Gift item"
              description="Shows in the gifts collection when enabled"
              checked={form.giftItem}
              onChange={(e) => update("giftItem", e.target.checked)}
            />
          </div>
        </div>
      </section>

      {/* Variants */}
      <section className="rounded-lg border border-sand bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Variants</h2>
            <p className="text-xs text-ink/55">Pack sizes with their own SKU, price and stock. Prices typed in rupees.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setVariantRows((rows) => [...rows, emptyVariantRow()])}>
            + Add variant
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          {variantRows.length === 0 ? (
            <p className="rounded-md bg-cream p-3 text-sm text-ink/60">No variants yet — add at least one sellable pack.</p>
          ) : null}
          {variantRows.map((row, idx) => (
            <fieldset key={row.key} className="rounded-md border border-sand bg-cream/40 p-3">
              <legend className="px-1 text-xs font-semibold text-ink/70">Variant {idx + 1}</legend>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                <Field label="SKU" required className="col-span-2">
                  <Input
                    value={row.sku}
                    onChange={(e) =>
                      setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, sku: e.target.value.toUpperCase() } : r)))
                    }
                    placeholder="AN-HNY-001-250G"
                  />
                </Field>
                <Field label="Pack label" required>
                  <Input
                    value={row.packLabel}
                    onChange={(e) => setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, packLabel: e.target.value } : r)))}
                    placeholder="250 g"
                  />
                </Field>
                <Field label="Grams" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={row.grams}
                    onChange={(e) => setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, grams: e.target.value } : r)))}
                    placeholder="250"
                  />
                </Field>
                <Field label="Price ₹" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, price: e.target.value } : r)))}
                    placeholder="449.00"
                  />
                </Field>
                <Field label="MRP ₹" hint="optional">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.mrp}
                    onChange={(e) => setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, mrp: e.target.value } : r)))}
                    placeholder="499.00"
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={row.status}
                    onChange={(e) =>
                      setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, status: e.target.value as ProductStatus } : r)))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Select>
                </Field>
                <Field label="Stock">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={row.stockOnHand}
                    onChange={(e) => setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, stockOnHand: e.target.value } : r)))}
                  />
                </Field>
                <Field label="Low-stock at">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={row.lowStockThreshold}
                    onChange={(e) =>
                      setVariantRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, lowStockThreshold: e.target.value } : r)))
                    }
                  />
                </Field>
              </div>
              <div className="mt-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVariantRows((rows) => rows.filter((r) => r.key !== row.key))}
                  className="text-red-700 hover:bg-red-50"
                >
                  Remove variant
                </Button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* Images */}
      <section className="rounded-lg border border-sand bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Images</h2>
            <p className="text-xs text-ink/55">Upload files straight to image hosting, or paste hosted URLs. First image is the cover.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MediaUploader
              onUploaded={(media) =>
                setImageRows((rows) => [
                  ...rows,
                  { key: `i${Math.random().toString(36).slice(2, 9)}`, url: media.url, alt: "", cloudinaryPublicId: media.publicId, ...(media.width ? { width: media.width } : {}), ...(media.height ? { height: media.height } : {}) },
                ])
              }
            >
              + Upload image
            </MediaUploader>
            <Button variant="outline" size="sm" onClick={() => setImageRows((rows) => [...rows, emptyImageRow()])}>
              + Add URL
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {imageRows.map((img) => (
            <div key={img.key} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field
                label="Image URL"
                className="flex-1"
                hint={img.cloudinaryPublicId ? "Hosted asset ✓" : undefined}
              >
                <Input
                  value={img.url}
                  onChange={(e) =>
                    setImageRows((rows) =>
                      rows.map((r) => (r.key === img.key ? { ...r, url: e.target.value, cloudinaryPublicId: r.url === e.target.value ? r.cloudinaryPublicId : undefined } : r)),
                    )
                  }
                  placeholder="https://res.cloudinary.com/…"
                />
              </Field>
              <Field label="Alt text" className="flex-1">
                <Input
                  value={img.alt}
                  onChange={(e) => setImageRows((rows) => rows.map((r) => (r.key === img.key ? { ...r, alt: e.target.value } : r)))}
                  placeholder="Honey jar with dipper"
                />
              </Field>
              <MediaUploader
                variant="ghost"
                onUploaded={(media) =>
                  setImageRows((rows) =>
                    rows.map((r) =>
                      r.key === img.key
                        ? { ...r, url: media.url, cloudinaryPublicId: media.publicId, ...(media.width ? { width: media.width } : {}), ...(media.height ? { height: media.height } : {}) }
                        : r,
                    ),
                  )
                }
              >
                Upload
              </MediaUploader>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImageRows((rows) => rows.filter((r) => r.key !== img.key))}
                className="text-red-700 hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          ))}
          {imageRows.length === 0 ? <p className="rounded-md bg-cream p-3 text-sm text-ink/60">No images yet — upload the first photo above.</p> : null}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-lg border border-sand bg-white p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Product details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Ingredients" className="md:col-span-2">
            <Textarea value={form.ingredients} onChange={(e) => update("ingredients", e.target.value)} rows={2} maxLength={2000} />
          </Field>
          <Field label="Net quantity label">
            <Input value={form.netQuantityLabel} onChange={(e) => update("netQuantityLabel", e.target.value)} maxLength={80} placeholder="Net qty: 250 g" />
          </Field>
          <Field label="FSSAI license" hint="Only when the business supplies it — never invented">
            <Input value={form.fssaiLicense} onChange={(e) => update("fssaiLicense", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Storage instructions">
            <Textarea value={form.storageInstructions} onChange={(e) => update("storageInstructions", e.target.value)} rows={2} maxLength={1000} />
          </Field>
          <Field label="Allergen info">
            <Textarea value={form.allergenInfo} onChange={(e) => update("allergenInfo", e.target.value)} rows={2} maxLength={500} />
          </Field>
          <Field label="Manufacturer details" className="md:col-span-2">
            <Textarea value={form.manufacturerDetails} onChange={(e) => update("manufacturerDetails", e.target.value)} rows={2} maxLength={500} />
          </Field>
        </div>
      </section>

      {/* Merchandising + SEO */}
      <section className="rounded-lg border border-sand bg-white p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold text-ink">Merchandising &amp; SEO</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Bestseller rank" hint="1 = first in bestsellers; blank = not ranked">
            <Input type="number" min="1" max="1000" value={form.bestsellerRank} onChange={(e) => update("bestsellerRank", e.target.value)} />
          </Field>
          <Field label="Featured rank" hint="1 = first in featured; blank = not featured">
            <Input type="number" min="1" max="1000" value={form.featuredRank} onChange={(e) => update("featuredRank", e.target.value)} />
          </Field>
          <Field label="SEO title">
            <Input value={form.seoTitle} onChange={(e) => update("seoTitle", e.target.value)} maxLength={180} />
          </Field>
          <Field label="SEO description">
            <Textarea value={form.seoDescription} onChange={(e) => update("seoDescription", e.target.value)} rows={2} maxLength={320} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
