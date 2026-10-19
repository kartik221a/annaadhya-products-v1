/**
 * InventoryService — the stock ledger. Every stock change goes through here,
 * carries a mandatory reason, and lands an audit-friendly movement record.
 * Concurrency safety: reserve/adjust run inside DataClient transactions.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
  COLLECTIONS,
  availableQty,
  type InventoryMovementDoc,
  type InventoryMovementType,
  type ProductVariantDoc,
  type StockMovementDto,
} from "@annaadhya/contracts";
import { badRequest, notFound, unprocessable, type DataClient } from "@annaadhya/data-core";
import { newId } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";
import type { AuthPrincipal } from "@annaadhya/contracts";

@Injectable()
export class InventoryService {
  constructor(@Inject(DATA_CLIENT) private readonly data: DataClient) {}

  async applyMovement(dto: StockMovementDto, actor: AuthPrincipal): Promise<InventoryMovementDoc> {
    // Server-side defense-in-depth: every movement needs a meaningful reason (the DTO also enforces this).
    if (!dto.reason || dto.reason.trim().length < 3) {
      throw badRequest("A reason of at least 3 characters is required for every stock movement");
    }
    // Movement semantics: which counters change and in which direction.
    const plan = movementPlan(dto.type, dto.qty);
    if (!plan) throw badRequest(`Unsupported movement type: ${dto.type}`);

    const movementId = newId("mv");
    await this.data.runTransaction(async (tx) => {
      const variant = await tx.get<ProductVariantDoc>(COLLECTIONS.productVariants, dto.variantId);
      if (!variant) throw notFound("Variant not found");
      if (variant.status === "archived") throw badRequest("Cannot move stock on an archived variant");

      const newStock = Math.max(0, variant.stockOnHand + plan.stockDelta);
      const newReserved = Math.max(0, variant.reservedQty + plan.reservedDelta);

      // Guard: cannot sell/commit more than available
      if (availableQty({ ...variant, stockOnHand: newStock, reservedQty: newReserved }) < 0) {
        throw unprocessable(`Movement would make ${variant.sku} oversold`);
      }
      if (plan.reservedDelta < 0 && variant.reservedQty + plan.reservedDelta < 0) {
        throw badRequest("Release would exceed current reserved quantity");
      }

      tx.update(COLLECTIONS.productVariants, variant.id, {
        stockOnHand: newStock,
        reservedQty: newReserved,
      });
      const movement: InventoryMovementDoc = {
        id: movementId,
        variantId: variant.id,
        variantSku: variant.sku,
        type: dto.type,
        qtyDelta: plan.stockDelta,
        reservedDelta: plan.reservedDelta,
        resultingStockOnHand: newStock,
        resultingReservedQty: newReserved,
        reason: dto.reason,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        performedByUid: actor.uid,
        performedByName: actor.displayName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDemo: false,
      };
      tx.set(COLLECTIONS.inventoryMovements, movementId, movement as object);
    });
    const doc = await this.data.get<InventoryMovementDoc>(COLLECTIONS.inventoryMovements, movementId);
    if (!doc) throw notFound("Movement missing after commit");
    return doc;
  }

  async movements(opts: { variantId?: string; type?: InventoryMovementType; limit?: number } = {}) {
    const where: { field: string; op: "=="; value: unknown }[] = [];
    if (opts.variantId) where.push({ field: "variantId", op: "==", value: opts.variantId });
    if (opts.type) where.push({ field: "type", op: "==", value: opts.type });
    return this.data.list<InventoryMovementDoc>(COLLECTIONS.inventoryMovements, {
      where,
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: opts.limit ?? 100,
    });
  }

  async lowStock(thresholdOverride?: number) {
    const variants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "status", op: "==", value: "published" }],
    });
    return variants
      .map((v) => ({ variant: v, available: availableQty(v) }))
      .filter(({ variant, available }) => available <= (thresholdOverride ?? variant.lowStockThreshold))
      .sort((a, b) => a.available - b.available);
  }

  async balances() {
    const variants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      orderBy: [{ field: "sku", direction: "asc" }],
      limit: 5000,
    });
    return variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      packLabel: v.packLabel,
      productId: v.productId,
      stockOnHand: v.stockOnHand,
      reservedQty: v.reservedQty,
      available: availableQty(v),
      lowStockThreshold: v.lowStockThreshold,
      status: v.status,
    }));
  }
}

interface MovementPlan {
  stockDelta: number;
  reservedDelta: number;
}

/** Map a movement type to its effect on (stockOnHand, reservedQty). */
function movementPlan(type: InventoryMovementType, qty: number): MovementPlan | null {
  const abs = Math.abs(qty);
  switch (type) {
    case "received":
      return { stockDelta: abs, reservedDelta: 0 };
    case "sold":
      return { stockDelta: -abs, reservedDelta: 0 };
    case "damaged":
      return { stockDelta: -abs, reservedDelta: 0 };
    case "returned":
      return { stockDelta: abs, reservedDelta: 0 };
    case "reserved":
      return { stockDelta: 0, reservedDelta: abs };
    case "released":
      return { stockDelta: 0, reservedDelta: -abs };
    case "manual_adjustment":
      return { stockDelta: qty, reservedDelta: 0 }; // signed: +3 / -2
    case "other":
      return { stockDelta: qty, reservedDelta: 0 };
    default:
      return null;
  }
}
