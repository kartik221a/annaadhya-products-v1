/** Suppliers & Purchases — supplier records plus quote→purchase→stock-receipt workflow. */
import { Inject, Injectable } from "@nestjs/common";
import {
  COLLECTIONS,
  type PurchaseDoc,
  type PurchaseUpsertDto,
  type SupplierDoc,
  type SupplierUpsertDto,
  type AuthPrincipal,
} from "@annaadhya/contracts";
import { badRequest, conflict, notFound, type DataClient } from "@annaadhya/data-core";
import { newId } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "../inventory/inventory.service";

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
    const doc: SupplierDoc = {
      id: id ?? newId("sup"),
      name: dto.name,
      phone: dto.phone,
      email: dto.email || undefined,
      location: dto.location,
      notes: dto.notes,
      productSkus: dto.productSkus,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      isDemo: existing?.isDemo ?? false,
    };
    await this.data.set(COLLECTIONS.suppliers, doc.id, doc);
    return doc;
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
      items: dto.items,
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
