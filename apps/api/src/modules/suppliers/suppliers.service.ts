/** Suppliers & Purchases — supplier records plus quote→purchase→stock-receipt workflow. */
import { Inject, Injectable } from "@nestjs/common";
import {
  COLLECTIONS,
  type CategoryDoc,
  type ProductDoc,
  type PurchaseDoc,
  type PurchaseUpsertDto,
  type SupplierDoc,
  type SupplierLedgerPage,
  type SupplierLedgerQueryDto,
  type SupplierLedgerRow,
  type SupplierLedgerSummary,
  type SupplierStatus,
  type SupplierUpsertDto,
  type AuthPrincipal,
} from "@annaadhya/contracts";
import { badRequest, conflict, notFound, type DataClient } from "@annaadhya/data-core";
import { newId } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "../inventory/inventory.service";

const IST_OFFSET_MINUTES = 330;

/** Start of the current IST calendar month, as epoch millis. */
function istMonthStart(now: number): number {
  const shifted = new Date(now + IST_OFFSET_MINUTES * 60_000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MINUTES * 60_000;
}

@Injectable()
export class SuppliersService {
  constructor(@Inject(DATA_CLIENT) private readonly data: DataClient) {}

  async list(opts: { search?: string } = {}): Promise<SupplierDoc[]> {
    const rows = await this.data.list<SupplierDoc>(COLLECTIONS.suppliers, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 500,
    });
    if (!opts.search) return rows;
    const needle = opts.search.toLowerCase();
    return rows.filter((s) => `${s.name} ${s.location ?? ""} ${s.productSkus.join(" ")}`.toLowerCase().includes(needle));
  }

  async get(id: string): Promise<SupplierDoc> {
    const doc = await this.data.get<SupplierDoc>(COLLECTIONS.suppliers, id);
    if (!doc) throw notFound("Supplier not found");
    return doc;
  }

  async upsert(dto: SupplierUpsertDto, id?: string): Promise<SupplierDoc> {
    const existing = id ? await this.data.get<SupplierDoc>(COLLECTIONS.suppliers, id) : null;
    // Defense-in-depth fallbacks: the zod pipe applies schema defaults on the HTTP path,
    // but direct callers (seed/tools) may post the legacy payload without the new keys.
    const productSkus = [...new Set((dto.productSkus ?? []).map((s) => s.toUpperCase()))];
    const ratesIn = dto.rates ?? [];
    const doc: SupplierDoc = {
      id: id ?? newId("sup"),
      name: dto.name,
      type: dto.type ?? "other",
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email || undefined,
      location: dto.location,
      village: dto.village,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode || undefined,
      addressLines: dto.addressLines,
      status: dto.status ?? "active",
      paymentTerms: dto.paymentTerms,
      licenseNumber: dto.licenseNumber,
      notes: dto.notes,
      productSkus,
      // Normalized rate rows: stable ids so edits can update a line in place; legacy
      // docs that predate rates simply get their first rate list here.
      rates: ratesIn.map((r, idx) => ({
        id: r.id ?? existing?.rates?.[idx]?.id ?? newId("rt"),
        label: r.label,
        productSku: r.productSku,
        variantSku: r.variantSku,
        unitCostPaise: r.unitCostPaise,
        unit: r.unit,
        moqQty: r.moqQty,
        notes: r.notes,
      })),
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      isDemo: existing?.isDemo ?? false,
    };
    await this.data.set(COLLECTIONS.suppliers, doc.id, doc);
    return doc;
  }

  /**
   * Status change (activate / seasonal pause). Touches ONLY the status field —
   * purchases keep their supplierId linkage and historical records are never touched.
   */
  async setStatus(id: string, status: SupplierStatus): Promise<SupplierDoc> {
    const existing = await this.get(id);
    if ((existing.status ?? "active") === status) return existing;
    return this.data.update<SupplierDoc>(COLLECTIONS.suppliers, id, { status, updatedAt: Date.now() });
  }

  /* --------------------------- suppliers console --------------------------- */

  /**
   * Paginated supplier ledger joined with REAL purchase history (from the purchases
   * collection) and catalogue category context. Summary metrics are computed over
   * the SAME filtered scope as the rows, so cards and table can never disagree.
   */
  async ledger(q: SupplierLedgerQueryDto): Promise<SupplierLedgerPage> {
    const now = Date.now();
    const monthStart = istMonthStart(now);
    const [suppliers, purchases, products, categories] = await Promise.all([
      this.data.list<SupplierDoc>(COLLECTIONS.suppliers, { limit: 2000 }),
      this.data.list<PurchaseDoc>(COLLECTIONS.purchases, {
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: 5000,
      }),
      this.data.list<ProductDoc>(COLLECTIONS.products, { limit: 5000 }),
      this.data.list<CategoryDoc>(COLLECTIONS.categories, { limit: 1000 }),
    ]);

    const productBySku = new Map(products.map((p) => [p.sku, p]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    // Purchase rollup per supplier — newest purchases first, so "last consignment"
    // is the first hit per supplier; totals accumulate over every record.
    const stats = new Map<string, { count: number; lastAt: number | null; lastRef: string | null; lastValue: number | null; totalValue: number }>();
    for (const p of purchases) {
      const value = p.items.reduce((sum, i) => sum + i.unitCostPaise * i.qtyOrdered, 0);
      const s = stats.get(p.supplierId) ?? { count: 0, lastAt: null, lastRef: null, lastValue: null, totalValue: 0 };
      s.count += 1;
      if (s.lastAt === null) {
        s.lastAt = p.createdAt;
        s.lastRef = p.reference;
        s.lastValue = value;
      }
      s.totalValue += value;
      stats.set(p.supplierId, s);
    }

    const rows: SupplierLedgerRow[] = suppliers.map((s) => {
      // Legacy documents predate type/status — render them with the documented fallbacks.
      const type = s.type ?? "other";
      const status: SupplierStatus = s.status ?? "active";
      const rates = s.rates ?? [];
      const linkedCategories: string[] = [];
      const seenCategories = new Set<string>();
      for (const sku of s.productSkus) {
        const product = productBySku.get(sku);
        if (!product || seenCategories.has(product.categoryId)) continue;
        seenCategories.add(product.categoryId);
        linkedCategories.push(categoryById.get(product.categoryId)?.name ?? "Unfiled");
      }
      const st = stats.get(s.id);
      const displayLocation =
        [s.city, s.state].filter(Boolean).join(", ") || s.location || undefined;
      return {
        id: s.id,
        name: s.name,
        type,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        city: s.city,
        state: s.state,
        location: displayLocation,
        status,
        village: s.village,
        pincode: s.pincode,
        paymentTerms: s.paymentTerms,
        licenseNumber: s.licenseNumber,
        notes: s.notes,
        productSkus: s.productSkus,
        rates,
        categoryNames: linkedCategories,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        purchaseCount: st?.count ?? 0,
        lastPurchaseAt: st?.lastAt ?? null,
        lastPurchaseReference: st?.lastRef ?? null,
        lastPurchaseValuePaise: st?.lastValue ?? null,
        totalPurchaseValuePaise: st?.totalValue ?? 0,
      };
    });

    let filtered = rows;
    if (q.type) filtered = filtered.filter((r) => r.type === q.type);
    if (q.status !== "all") filtered = filtered.filter((r) => r.status === q.status);
    if (q.categoryId) {
      const catName = categoryById.get(q.categoryId)?.name;
      filtered = filtered.filter((r) =>
        r.productSkus.some((sku) => productBySku.get(sku)?.categoryId === q.categoryId) ||
        (catName ? r.categoryNames.includes(catName) : false),
      );
    }
    if (q.search) {
      const needle = q.search.toLowerCase();
      filtered = filtered.filter((r) =>
        [
          r.name,
          r.contactPerson ?? "",
          r.phone ?? "",
          r.email ?? "",
          r.city ?? "",
          r.state ?? "",
          r.location ?? "",
          r.village ?? "",
          r.productSkus.join(" "),
          r.rates.map((rate) => rate.label).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }

    const summary: SupplierLedgerSummary = {
      totalSuppliers: filtered.length,
      activeSuppliers: filtered.filter((r) => r.status === "active").length,
      inactiveSuppliers: filtered.filter((r) => r.status === "inactive").length,
      categoryCount: new Set(
        filtered.flatMap((r) =>
          r.productSkus.map((sku) => productBySku.get(sku)?.categoryId).filter((id): id is string => Boolean(id)),
        ),
      ).size,
      addedThisMonth: filtered.filter((r) => r.createdAt >= monthStart).length,
      withPurchases: filtered.filter((r) => r.purchaseCount > 0).length,
    };

    switch (q.sort) {
      case "name_asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "recent_purchase":
        filtered.sort(
          (a, b) => (b.lastPurchaseAt ?? 0) - (a.lastPurchaseAt ?? 0) || b.createdAt - a.createdAt,
        );
        break;
      case "value_desc":
        filtered.sort((a, b) => b.totalPurchaseValuePaise - a.totalPurchaseValuePaise || b.createdAt - a.createdAt);
        break;
      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
    }

    const total = filtered.length;
    const start = (q.page - 1) * q.pageSize;
    return {
      items: filtered.slice(start, start + q.pageSize),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      summary,
    };
  }

  async archive(id: string): Promise<void> {
    await this.get(id);
    await this.data.update(COLLECTIONS.suppliers, id, { updatedAt: Date.now() });
  }
}

@Injectable()
export class PurchasesService {
  constructor(
    @Inject(DATA_CLIENT) private readonly data: DataClient,
    private readonly suppliers: SuppliersService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { supplierId?: string; status?: PurchaseDoc["status"] } = {}): Promise<PurchaseDoc[]> {
    const where: { field: string; op: "=="; value: unknown }[] = [];
    if (filters.supplierId) where.push({ field: "supplierId", op: "==", value: filters.supplierId });
    if (filters.status) where.push({ field: "status", op: "==", value: filters.status });
    return this.data.list<PurchaseDoc>(COLLECTIONS.purchases, {
      where,
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: 500,
    });
  }

  async get(id: string): Promise<PurchaseDoc> {
    const doc = await this.data.get<PurchaseDoc>(COLLECTIONS.purchases, id);
    if (!doc) throw notFound("Purchase not found");
    return doc;
  }

  async upsert(dto: PurchaseUpsertDto, id?: string): Promise<PurchaseDoc> {
    await this.suppliers.get(dto.supplierId); // must exist
    const existing = id ? await this.data.get<PurchaseDoc>(COLLECTIONS.purchases, id) : null;
    const doc: PurchaseDoc = {
      id: id ?? newId("pur"),
      supplierId: dto.supplierId,
      reference: dto.reference,
      status: dto.status,
      // Normalized item snapshots (validated by zod) — keeps PurchaseItem
      // fields non-optional under non-strict type-checking too.
      items: dto.items.map((it) => ({
        variantSku: it.variantSku ?? "",
        description: it.description ?? "",
        qtyOrdered: it.qtyOrdered ?? 0,
        qtyReceived: it.qtyReceived ?? 0,
        unitCostPaise: it.unitCostPaise ?? 0,
      })),
      notes: dto.notes,
      createdByUid: existing?.createdByUid ?? "system",
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      isDemo: existing?.isDemo ?? false,
    };
    await this.data.set(COLLECTIONS.purchases, doc.id, doc);
    return doc;
  }

  /**
   * Record received quantities. Receiving stock creates `received` inventory movements —
   * the only path that turns a purchase into sellable stock.
   */
  async receive(purchaseId: string, receipts: { variantSku: string; qty: number }[], actor: AuthPrincipal): Promise<PurchaseDoc> {
    const purchase = await this.get(purchaseId);
    if (purchase.status === "cancelled") throw badRequest("Cannot receive a cancelled purchase");
    if (purchase.status === "received") throw badRequest("Purchase is already fully received");

    for (const r of receipts) {
      const item = purchase.items.find((i) => i.variantSku === r.variantSku);
      if (!item) throw badRequest(`Purchase does not include ${r.variantSku}`);
      if (r.qty <= 0) continue;
      const outstanding = item.qtyOrdered - item.qtyReceived;
      if (r.qty > outstanding) {
        throw conflict(`Receiving ${r.qty} of ${r.variantSku} exceeds outstanding ${outstanding}`);
      }
      item.qtyReceived += r.qty;

      // Find the variant by SKU to post the movement
      const variants = await this.data.list<{ id: string }>(COLLECTIONS.productVariants, {
        where: [{ field: "sku", op: "==", value: r.variantSku }],
        limit: 1,
      });
      if (variants[0]) {
        await this.inventory.applyMovement(
          {
            variantId: variants[0].id,
            type: "received",
            qty: r.qty,
            reason: `Purchase ${purchase.reference} received`,
            referenceType: "purchase",
            referenceId: purchase.id,
          },
          actor,
        );
      }
    }

    const fullyReceived = purchase.items.every((i) => i.qtyReceived >= i.qtyOrdered);
    const anyReceived = purchase.items.some((i) => i.qtyReceived > 0);
    purchase.status = fullyReceived ? "received" : anyReceived ? "partially_received" : purchase.status;
    purchase.updatedAt = Date.now();
    await this.data.set(COLLECTIONS.purchases, purchase.id, purchase);

    await this.audit.record({
      actor,
      action: "purchase.receive",
      targetType: "purchase",
      targetId: purchase.id,
      summary: `Received ${receipts.length} line(s) on purchase ${purchase.reference}`,
    });
    return purchase;
  }
}
