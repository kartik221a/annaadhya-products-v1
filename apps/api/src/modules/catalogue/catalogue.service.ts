/** Catalogue service — public browsing (published only) + admin CRUD with SKU uniqueness. */
import { Injectable } from "@nestjs/common";
import {
  COLLECTIONS,
  availableQty,
  type CategoryDoc,
  type ListQueryDto,
  type Page,
  type ProductDoc,
  type ProductUpsertDto,
  type CategoryUpsertDto,
  type ProductVariantDoc,
} from "@annaadhya/contracts";
import { conflict, notFound, type DataClient } from "@annaadhya/data-core";
import { slugify } from "@annaadhya/utils";

export interface ProductWithVariants extends ProductDoc {
  variants: ProductVariantDoc[];
}

@Injectable()
export class CatalogueService {
  constructor(private readonly data: DataClient) {}

  /* ------------------------------- public -------------------------------- */

  async listCategories(includeNotReady = false): Promise<CategoryDoc[]> {
    const rows = await this.data.list<CategoryDoc>(COLLECTIONS.categories, {
      where: [{ field: "status", op: "==", value: "published" }],
      orderBy: [{ field: "sortOrder", direction: "asc" }],
    });
    return includeNotReady ? rows : rows.filter((c) => c.isReady);
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDoc | null> {
    const rows = await this.data.list<CategoryDoc>(COLLECTIONS.categories, {
      where: [{ field: "slug", op: "==", value: slug }],
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async listProducts(q: ListQueryDto): Promise<Page<ProductWithVariants>> {
    const where: { field: string; op: "==" | ">=" | "<=" | "in"; value: unknown }[] = [
      { field: "status", op: "==", value: "published" },
    ];

    let categoryId: string | undefined;
    if (q.category) {
      const cat = await this.getCategoryBySlug(q.category);
      if (!cat || (!cat.isReady && !q.includeUnavailable)) {
        return emptyPage(q.page, q.pageSize);
      }
      categoryId = cat.id;
    }

    let products = await this.data.list<ProductDoc>(COLLECTIONS.products, { where });
    if (categoryId) products = products.filter((p) => p.categoryId === categoryId);

    // Load all variants of matching products, then filter/sort on the min variant price.
    const variantRows = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "status", op: "==", value: "published" }],
    });
    const variantsByProduct = new Map<string, ProductVariantDoc[]>();
    for (const v of variantRows) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    let rows: ProductWithVariants[] = [];
    for (const p of products) {
      const variants = variantsByProduct.get(p.id) ?? [];
      if (variants.length === 0) continue; // products without variants are not sellable yet
      if (!q.includeUnavailable && variants.every((v) => availableQty(v) <= 0)) continue;
      if (q.search) {
        const needle = q.search.toLowerCase();
        const haystack = `${p.name} ${p.subtitle} ${p.typeLabel} ${p.description} ${p.sku}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      rows.push({ ...p, variants });
    }

    const minPrice = (r: ProductWithVariants) => Math.min(...r.variants.map((v) => v.pricePaise));
    const maxPrice = (r: ProductWithVariants) => Math.max(...r.variants.map((v) => v.pricePaise));
    if (q.minPricePaise !== undefined) rows = rows.filter((r) => minPrice(r) >= q.minPricePaise!);
    if (q.maxPricePaise !== undefined) rows = rows.filter((r) => maxPrice(r) <= q.maxPricePaise!);

    switch (q.sort) {
      case "price_asc":
        rows.sort((a, b) => minPrice(a) - minPrice(b));
        break;
      case "price_desc":
        rows.sort((a, b) => maxPrice(b) - maxPrice(a));
        break;
      case "newest":
        rows.sort((a, b) => b.createdAt - a.createdAt);
        break;
      default:
        rows.sort((a, b) => (a.bestsellerRank ?? 9999) - (b.bestsellerRank ?? 9999) || b.createdAt - a.createdAt);
    }

    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    return {
      items: rows.slice(start, start + q.pageSize),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }

  async getProductBySlug(slug: string, opts: { onlyPublished?: boolean } = {}): Promise<ProductWithVariants | null> {
    const rows = await this.data.list<ProductDoc>(COLLECTIONS.products, {
      where: [{ field: "slug", op: "==", value: slug }],
      limit: 1,
    });
    const product = rows[0];
    if (!product) return null;
    if (opts.onlyPublished !== false && product.status !== "published") return null;
    return this.attachVariants(product);
  }

  async getProductById(id: string): Promise<ProductWithVariants | null> {
    const product = await this.data.get<ProductDoc>(COLLECTIONS.products, id);
    if (!product) return null;
    return this.attachVariants(product);
  }

  async relatedProducts(product: ProductWithVariants, limit = 4): Promise<ProductWithVariants[]> {
    const sameCategory = await this.data.list<ProductDoc>(COLLECTIONS.products, {
      where: [
        { field: "status", op: "==", value: "published" },
        { field: "categoryId", op: "==", value: product.categoryId },
      ],
      limit: limit + 1,
    });
    const rows: ProductWithVariants[] = [];
    for (const p of sameCategory) {
      if (p.id === product.id) continue;
      const withVariants = await this.attachVariants(p);
      if (withVariants) rows.push(withVariants);
    }
    return rows.slice(0, limit);
  }

  async bestsellers(limit = 8): Promise<ProductWithVariants[]> {
    const rows = await this.data.list<ProductDoc>(COLLECTIONS.products, {
      where: [{ field: "status", op: "==", value: "published" }],
    });
    const withVariants = (await Promise.all(rows.map((p) => this.attachVariants(p)))).filter(
      (p): p is ProductWithVariants => Boolean(p) && (p!.variants?.length ?? 0) > 0,
    );
    return withVariants
      .filter((p) => p.bestsellerRank !== undefined)
      .sort((a, b) => a.bestsellerRank! - b.bestsellerRank!)
      .slice(0, limit);
  }

  async featured(limit = 8): Promise<ProductWithVariants[]> {
    const rows = await this.data.list<ProductDoc>(COLLECTIONS.products, {
      where: [{ field: "status", op: "==", value: "published" }],
    });
    const withVariants = (await Promise.all(rows.map((p) => this.attachVariants(p)))).filter(
      (p): p is ProductWithVariants => Boolean(p) && (p!.variants?.length ?? 0) > 0,
    );
    return withVariants
      .filter((p) => p.featuredRank !== undefined)
      .sort((a, b) => a.featuredRank! - b.featuredRank!)
      .slice(0, limit);
  }

  private async attachVariants(product: ProductDoc): Promise<ProductWithVariants | null> {
    const variants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "productId", op: "==", value: product.id }],
      orderBy: [{ field: "grams", direction: "asc" }],
    });
    return { ...product, variants };
  }

  /* -------------------------------- admin --------------------------------- */

  async upsertProduct(dto: ProductUpsertDto, productId?: string): Promise<ProductWithVariants> {
    // Category must exist
    const category = await this.data.get<CategoryDoc>(COLLECTIONS.categories, dto.categoryId);
    if (!category) throw conflict(`Category ${dto.categoryId} does not exist`);

    // SKU uniqueness (excluding this product)
    const bySku = await this.data.list<ProductDoc>(COLLECTIONS.products, {
      where: [{ field: "sku", op: "==", value: dto.sku }],
      limit: 2,
    });
    const clash = bySku.find((p) => p.id !== productId);
    if (clash) throw conflict(`SKU ${dto.sku} is already used by another product`);

    // Variant SKU uniqueness
    const variantSkus = dto.variants.map((v) => v.sku);
    const dupVariant = variantSkus.find((s, i) => variantSkus.indexOf(s) !== i);
    if (dupVariant) throw conflict(`Duplicate variant SKU in request: ${dupVariant}`);
    for (const vs of variantSkus) {
      const existing = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
        where: [{ field: "sku", op: "==", value: vs }],
        limit: 2,
      });
      const foreign = existing.find((v) => v.productId !== productId);
      if (foreign) throw conflict(`Variant SKU ${vs} is already used by another product`);
    }
    // MRP sanity
    for (const v of dto.variants) {
      if (v.mrpPaise !== undefined && v.mrpPaise < v.pricePaise) {
        throw conflict(`MRP must be >= selling price for variant ${v.sku}`);
      }
    }

    const now = Date.now();
    const id = productId ?? `prod_${slugify(dto.sku)}`;
    const existingDoc = await this.data.get<ProductDoc>(COLLECTIONS.products, id);

    const product: ProductDoc = {
      id,
      sku: dto.sku,
      slug: existingDoc?.slug ?? slugify(dto.name),
      name: dto.name,
      subtitle: dto.subtitle,
      description: dto.description,
      categoryId: dto.categoryId,
      typeLabel: dto.typeLabel,
      status: dto.status,
      images: dto.images,
      ingredients: dto.ingredients,
      netQuantityLabel: dto.netQuantityLabel,
      storageInstructions: dto.storageInstructions,
      allergenInfo: dto.allergenInfo,
      manufacturerDetails: dto.manufacturerDetails,
      fssaiLicense: dto.fssaiLicense,
      bestsellerRank: dto.bestsellerRank,
      featuredRank: dto.featuredRank,
      giftItem: dto.giftItem,
      seo: dto.seo,
      createdAt: existingDoc?.createdAt ?? now,
      updatedAt: now,
      isDemo: existingDoc?.isDemo ?? false,
    };
    await this.data.set(COLLECTIONS.products, id, product);

    // Variants: upsert by sku; existing stock is preserved on update
    const existingVariants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "productId", op: "==", value: id }],
    });
    const existingBySku = new Map(existingVariants.map((v) => [v.sku, v]));

    for (const v of dto.variants) {
      const prev = existingBySku.get(v.sku);
      const variant: ProductVariantDoc = {
        id: prev?.id ?? `var_${slugify(v.sku)}`,
        productId: id,
        sku: v.sku,
        packLabel: v.packLabel,
        grams: v.grams,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        status: v.status,
        stockOnHand: v.stockOnHand ?? prev?.stockOnHand ?? 0,
        reservedQty: prev?.reservedQty ?? 0,
        lowStockThreshold: v.lowStockThreshold,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        isDemo: prev?.isDemo ?? false,
      };
      await this.data.set(COLLECTIONS.productVariants, variant.id, variant);
      existingBySku.delete(v.sku);
    }
    // Variants removed from the payload get archived (never hard-deleted — orders reference them)
    for (const leftover of existingBySku.values()) {
      await this.data.update(COLLECTIONS.productVariants, leftover.id, { status: "archived" });
    }

    const result = await this.getProductById(id);
    if (!result) throw conflict("Product upsert failed");
    return result;
  }

  async upsertCategory(dto: CategoryUpsertDto, categoryId?: string): Promise<CategoryDoc> {
    const id = categoryId ?? `cat_${dto.slug}`;
    const existing = await this.data.get<CategoryDoc>(COLLECTIONS.categories, id);
    const now = Date.now();
    const doc: CategoryDoc = {
      id,
      slug: dto.slug,
      name: dto.name,
      tagline: dto.tagline,
      description: dto.description,
      sortOrder: dto.sortOrder,
      isReady: dto.isReady,
      heroImage: dto.heroImage,
      status: dto.status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      isDemo: existing?.isDemo ?? false,
    };
    await this.data.set(COLLECTIONS.categories, id, doc);
    return doc;
  }

  async archiveProduct(productId: string): Promise<void> {
    const product = await this.data.get<ProductDoc>(COLLECTIONS.products, productId);
    if (!product) throw notFound("Product not found");
    await this.data.update(COLLECTIONS.products, productId, { status: "archived" });
    const variants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "productId", op: "==", value: productId }],
    });
    for (const v of variants) {
      await this.data.update(COLLECTIONS.productVariants, v.id, { status: "archived" });
    }
  }
}

function emptyPage(page: number, pageSize: number): Page<ProductWithVariants> {
  return { items: [], page, pageSize, total: 0, totalPages: 1 };
}
