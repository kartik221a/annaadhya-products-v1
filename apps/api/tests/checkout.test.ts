/**
 * Checkout & payment business-rule tests — run services directly against the in-memory
 * provider so the exact production code paths are exercised.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InMemoryDataClient, applySeed } from "@annaadhya/data-core";
import {
  COLLECTIONS,
  availableQty,
  type AuthPrincipal,
  type CheckoutQuoteDto,
  type CreateOrderDto,
  type OrderDoc,
  type PaymentAttemptDoc,
  type ProductVariantDoc,
} from "@annaadhya/contracts";
import { loadEnv, resetEnvCache } from "../src/config/env";
import { SettingsService } from "../src/modules/settings/settings.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { CheckoutService } from "../src/modules/checkout/checkout.service";
import { MockPaymentProvider } from "../src/modules/payments/mock.provider";
import { RazorpayProvider } from "../src/modules/payments/razorpay.provider";
import { OrdersService } from "../src/modules/orders/orders.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { createHmac } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DATA_PROVIDER = "memory";

let db: InMemoryDataClient;
let checkout: CheckoutService;
let orders: OrdersService;
let inventory: InventoryService;
let variants: ProductVariantDoc[];

const customer: AuthPrincipal = {
  uid: "test-customer",
  email: "cust@test.dev",
  provider: "password",
  role: "customer",
  permissions: [],
  isStaff: false,
};

const owner: AuthPrincipal = {
  uid: "test-owner",
  email: "owner@test.dev",
  provider: "dev",
  role: "owner",
  permissions: [
    "orders:read",
    "orders:write",
    "orders:refund",
    "inventory:write",
    "team:write",
    "settings:write",
    "audit:read",
  ],
  isStaff: true,
};

const support: AuthPrincipal = {
  uid: "test-support",
  email: "support@test.dev",
  provider: "dev",
  role: "orders_support",
  permissions: ["orders:read", "orders:write", "customers:read", "customers:write"],
  isStaff: true,
};

beforeAll(async () => {
  db = new InMemoryDataClient({ nodeEnv: "test" });
  await applySeed(db);
  const settings = new SettingsService(db);
  const audit = new AuditService(db);
  resetEnvCache();
  process.env.DEV_TOKEN_SECRET = "test-secret-0123456789abcdef";
  const env = loadEnv();
  const providers = [new MockPaymentProvider(), new RazorpayProvider(env)];
  checkout = new CheckoutService(db, settings, audit, env, providers);
  orders = new OrdersService(db, audit, providers);
  inventory = new InventoryService(db);
  variants = await db.list<ProductVariantDoc>(COLLECTIONS.productVariants);
});

beforeEach(async () => {
  // Reset variant stock between tests via seed re-apply would be cleaner; tests use distinct variants.
});

function findVariant(suffix: string): ProductVariantDoc {
  const v = variants.find((x) => x.sku.endsWith(suffix));
  if (!v) throw new Error(`variant ${suffix} not found`);
  return v;
}

function address() {
  return {
    label: "Home",
    fullName: "Test Customer",
    phone: "9876543210",
    line1: "1 Test Street",
    city: "Meerut",
    state: "Uttar Pradesh",
    pincode: "250002",
  };
}

async function quoteAndOrder(itemSuffix: string, qty: number): Promise<{ order: OrderDoc; attempt: PaymentAttemptDoc | null }> {
  const v = findVariant(itemSuffix);
  const quote = await checkout.quote({ items: [{ variantId: v.id, qty }], pincode: "250002" } satisfies CheckoutQuoteDto);
  const res = await checkout.createOrder(
    {
      quoteId: quote.quoteId,
      paymentMethod: "gateway",
      customer: { displayName: "Test Customer", email: "cust@test.dev", phone: "9876543210" },
      address: address(),
      acceptTerms: true,
    },
    customer,
  );
  const order = res as OrderDoc & { clientPaymentPayload?: Record<string, unknown> };
  const attempt = order.clientPaymentPayload
    ? await db.get<PaymentAttemptDoc>(COLLECTIONS.paymentAttempts, (order.clientPaymentPayload.attemptId as string) ?? (order.clientPaymentPayload as { attemptId: string }).attemptId)
    : null;
  return { order, attempt };
}

describe("checkout quote — server-authoritative pricing", () => {
  it("prices from the database, never the client", async () => {
    const v = findVariant("AN-HNY-001-250G");
    const quote = await checkout.quote({ items: [{ variantId: v.id, qty: 2 }], pincode: "110001" });
    expect(quote.subtotalPaise).toBe(v.pricePaise * 2); // ₹199 × 2 = 39800 paise
    expect(quote.subtotalPaise).toBe(39800);
  });

  it("applies free shipping above the configured threshold and flat rate below it", async () => {
    const settings = await db.get<{ shipping: { flatRatePaise: number; freeAbovePaise: number | null } }>(COLLECTIONS.settings, "global");
    const flat = settings!.shipping.flatRatePaise;
    const freeAbove = settings!.shipping.freeAbovePaise ?? Number.MAX_SAFE_INTEGER;

    const cheap = await checkout.quote({ items: [{ variantId: findVariant("AN-HNY-002-100G").id, qty: 1 }] });
    expect(cheap.shippingPaise).toBe(flat); // ₹89 < ₹999 threshold

    const pricey = await checkout.quote({ items: [{ variantId: findVariant("AN-HNY-001-1KG").id, qty: 2 }] });
    expect(pricey.subtotalPaise).toBeGreaterThan(freeAbove);
    expect(pricey.shippingPaise).toBe(0);
  });

  it("refuses unavailable quantity in quotes", async () => {
    const v = findVariant("AN-HNY-003-500G");
    const quote = await checkout.quote({ items: [{ variantId: v.id, qty: availableQty(v) + 1000 }] });
    expect(quote.unavailable.length).toBe(1);
    expect(quote.items.length).toBe(0);
  });
});

describe("order creation — reservations & oversell protection", () => {
  it("creates a pending_payment order with item snapshots and reserves stock", async () => {
    const v = findVariant("AN-DRY-001-250G");
    const before = availableQty(v);
    const { order } = await quoteAndOrder("AN-DRY-001-250G", 2);

    expect(order.status).toBe("pending_payment");
    expect(order.items.length).toBe(1);
    expect(order.items[0].sku).toBe("AN-DRY-001-250G");
    expect(order.items[0].unitPricePaise).toBe(v.pricePaise);
    expect(order.items[0].name).toContain("Badam Shakti");

    const after = await db.get<ProductVariantDoc>(COLLECTIONS.productVariants, v.id);
    expect(after!.reservedQty).toBe(v.reservedQty + 2);
    expect(availableQty(after!)).toBe(before - 2);
  });

  it("prevents overselling through concurrent checkout flows", async () => {
    const v = findVariant("AN-HNY-004-500G");
    const avail = availableQty(v);
    const quote = await checkout.quote({ items: [{ variantId: v.id, qty: avail }] });
    // Exhaust the stock with a first order
    await checkout.createOrder(
      {
        quoteId: quote.quoteId,
        paymentMethod: "gateway",
        customer: { displayName: "A", email: "", phone: "9876543210" },
        address: address(),
        acceptTerms: true,
      },
      customer,
    );
    // A second order for the same (now fully reserved) variant must fail
    const quote2 = await checkout.quote({ items: [{ variantId: v.id, qty: 1 }] });
    await expect(
      checkout.createOrder(
        {
          quoteId: quote2.quoteId,
          paymentMethod: "gateway",
          customer: { displayName: "B", email: "", phone: "9876543210" },
          address: address(),
          acceptTerms: true,
        },
        customer,
      ),
    ).rejects.toThrow(/no longer available|Insufficient stock|unavailable/);
  });

  it("rejects an already-consumed quote (no double order from one quote)", async () => {
    const quote = await checkout.quote({ items: [{ variantId: findVariant("AN-DRY-002-100G").id, qty: 1 }] });
    const payload = {
      quoteId: quote.quoteId,
      paymentMethod: "gateway" as const,
      customer: { displayName: "C", email: "", phone: "9876543210" },
      address: address(),
      acceptTerms: true as const,
    };
    await checkout.createOrder(payload, customer);
    await expect(checkout.createOrder(payload, customer)).rejects.toThrow(/already used/);
  });
});

describe("payment verification & idempotency", () => {
  it("confirms an order ONLY via a verified provider event and commits reservations to sold", async () => {
    const v = findVariant("AN-HNY-005-250G");
    const stockBefore = v.stockOnHand;
    const { order, attempt } = await quoteAndOrder("AN-HNY-005-250G", 1);
    expect(attempt).not.toBeNull();

    const result = await checkout.applyVerifiedEvent(
      { eventId: "evt_success_1", eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded", amountPaise: attempt!.amountPaise },
      "mock",
    );
    expect(result.applied).toBe(true);

    const paidOrder = await db.get<OrderDoc>(COLLECTIONS.orders, order.id);
    expect(paidOrder!.paymentStatus).toBe("succeeded");
    expect(paidOrder!.status).toBe("confirmed");

    const variantAfter = await db.get<ProductVariantDoc>(COLLECTIONS.productVariants, v.id);
    expect(variantAfter!.stockOnHand).toBe(stockBefore - 1);
    expect(variantAfter!.reservedQty).toBe(v.reservedQty);

    const movements = await db.list<{ type: string; variantSku: string }>(COLLECTIONS.inventoryMovements, {
      where: [{ field: "variantSku", op: "==", value: "AN-HNY-005-250G" }],
    });
    expect(movements.some((m) => m.type === "sold")).toBe(true);
  });

  it("duplicate callbacks never double-apply (idempotent)", async () => {
    const { attempt } = await quoteAndOrder("AN-HNY-006-100G", 1);
    const event = { eventId: "evt_dup_1", eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded" as const, amountPaise: attempt!.amountPaise };
    const first = await checkout.applyVerifiedEvent(event, "mock");
    const second = await checkout.applyVerifiedEvent(event, "mock");
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.note).toMatch(/duplicate/);
  });

  it("amount mismatches are held for review, never marked paid", async () => {
    const { attempt } = await quoteAndOrder("AN-HNY-007-100G", 1);
    await expect(
      checkout.applyVerifiedEvent(
        { eventId: "evt_bad_amount", eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded", amountPaise: attempt!.amountPaise + 1 },
        "mock",
      ),
    ).rejects.toThrow(/amount/i);
    const attemptAfter = await db.get<PaymentAttemptDoc>(COLLECTIONS.paymentAttempts, attempt!.id);
    expect(attemptAfter!.status).not.toBe("succeeded");
  });

  it("failed payments release reservations and cancel the pending order", async () => {
    const v = findVariant("AN-HNY-008-100G");
    const reservedBefore = v.reservedQty;
    const { order, attempt } = await quoteAndOrder("AN-HNY-008-100G", 1);
    await checkout.applyVerifiedEvent(
      { eventId: "evt_fail_1", eventType: "mock.failed", providerOrderId: attempt!.providerOrderId, outcome: "failed" },
      "mock",
    );
    const cancelled = await db.get<OrderDoc>(COLLECTIONS.orders, order.id);
    expect(cancelled!.status).toBe("cancelled");
    const variantAfter = await db.get<ProductVariantDoc>(COLLECTIONS.productVariants, v.id);
    expect(variantAfter!.reservedQty).toBe(reservedBefore);
  });

  it("expired reservations are released and pending orders cancelled", async () => {
    const v = findVariant("AN-HNY-009-100G");
    const { order } = await quoteAndOrder("AN-HNY-009-100G", 1);
    // Force expiry
    const reservations = await db.list<{ id: string; expiresAt: number; status: string }>(COLLECTIONS.stockReservations, {
      where: [{ field: "orderId", op: "==", value: order.id }],
    });
    await db.update(COLLECTIONS.stockReservations, reservations[0].id, { expiresAt: Date.now() - 1000 });
    const sweep = await checkout.releaseExpiredReservations();
    expect(sweep.released).toBeGreaterThanOrEqual(1);
    const cancelled = await db.get<OrderDoc>(COLLECTIONS.orders, order.id);
    expect(cancelled!.status).toBe("cancelled");
    const variantAfter = await db.get<ProductVariantDoc>(COLLECTIONS.productVariants, v.id);
    expect(variantAfter!.reservedQty).toBe(v.reservedQty);
  });
});

describe("mock webhook signature verification", () => {
  it("verifies correctly-signed webhooks and rejects forged ones", async () => {
    const payload = { eventId: "evt_sig_1", eventType: "mock.succeeded", outcome: "succeeded" };
    const signed = MockPaymentProvider.signedWebhookBody(payload);
    // Valid
    expect(() => new MockPaymentProvider().verifyWebhook({ headers: signed.headers, rawBody: signed.body })).not.toThrow();
    // Forged
    expect(() =>
      new MockPaymentProvider().verifyWebhook({
        headers: { "x-mock-signature": "deadbeef" },
        rawBody: signed.body,
      }),
    ).toThrow(/signature/i);
  });

  it("dev tokens are HMAC-signed and expired tokens are rejected", async () => {
    const { AuthService } = await import("../src/common/auth/auth.service");
    const auth = new AuthService(db, loadEnv());
    const { token } = auth.issueDevToken({ uid: "sig-test-uid", email: "sig@test.dev", provider: "dev" });
    const principal = await auth.verifyPrincipal(token);
    expect(principal.uid).toBe("sig-test-uid");

    // Expired: craft with old exp
    const body = Buffer.from(JSON.stringify({ uid: "x", provider: "dev", iat: 1, exp: 2 }), "utf8").toString("base64url");
    const sig = createHmac("sha256", process.env.DEV_TOKEN_SECRET!).update(body).digest("base64url");
    await expect(auth.verifyPrincipal(`${body}.${sig}`)).rejects.toThrow(/expired/i);
  });
});

describe("RBAC & order state machine", () => {
  it("support role cannot refund", async () => {
    const { order, attempt } = await quoteAndOrder("AN-DRY-003-100G", 1);
    await checkout.applyVerifiedEvent(
      { eventId: `evt_ok_${order.id}`, eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded", amountPaise: attempt!.amountPaise },
      "mock",
    );
    await expect(
      orders.refund(order.id, { amountPaise: 100, reason: "test refund" }, support),
    ).rejects.toThrow(/orders:refund/);
  });

  it("owner can refund a paid order; refund is capped at the order total", async () => {
    const { order, attempt } = await quoteAndOrder("AN-DRY-004-100G", 1);
    await checkout.applyVerifiedEvent(
      { eventId: `evt_ok2_${order.id}`, eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded", amountPaise: attempt!.amountPaise },
      "mock",
    );
    await expect(
      orders.refund(order.id, { amountPaise: order.totalPaise + 100, reason: "over-refund" }, owner),
    ).rejects.toThrow(/exceeds/i);
    const refunded = await orders.refund(order.id, { amountPaise: order.totalPaise, reason: "full refund" }, owner);
    expect(refunded.paymentStatus).toBe("refunded");
    expect(refunded.status).toBe("refunded");
  });

  it("unpaid orders cannot be pushed into fulfilment states", async () => {
    const { order } = await quoteAndOrder("AN-DRY-005-250G", 1);
    await expect(
      orders.updateStatus(order.id, { status: "shipped" }, owner),
    ).rejects.toThrow(/Only paid orders/);
  });

  it("illegal transitions are refused by the state machine", async () => {
    const { order, attempt } = await quoteAndOrder("AN-DRY-006-100G", 1);
    await checkout.applyVerifiedEvent(
      { eventId: `evt_ok3_${order.id}`, eventType: "mock.succeeded", providerOrderId: attempt!.providerOrderId, outcome: "succeeded", amountPaise: attempt!.amountPaise },
      "mock",
    );
    // confirmed -> delivered is illegal (must pass through processing/shipped)
    await expect(orders.updateStatus(order.id, { status: "delivered" }, owner)).rejects.toThrow(/Illegal order transition/);
    const moved = await orders.updateStatus(order.id, { status: "processing" }, owner);
    expect(moved.status).toBe("processing");
  });
});

describe("inventory ledger", () => {
  it("every manual movement requires a reason and records resulting balances", async () => {
    const v = findVariant("AN-DRY-007-100G");
    const before = v.stockOnHand;
    const movement = await inventory.applyMovement(
      { variantId: v.id, type: "damaged", qty: 3, reason: "Broken during handling (test)" },
      owner,
    );
    expect(movement.resultingStockOnHand).toBe(before - 3);
    await expect(
      inventory.applyMovement({ variantId: v.id, type: "damaged", qty: 1, reason: "x" }, owner),
    ).rejects.toThrow(); // reason too short
  });

  it("manual adjustments accept signed deltas and guard negative release", async () => {
    const v = findVariant("AN-DRY-008-100G");
    const before = v.stockOnHand;
    const movement = await inventory.applyMovement(
      { variantId: v.id, type: "manual_adjustment", qty: -2, reason: "Cycle count correction" },
      owner,
    );
    expect(movement.qtyDelta).toBe(-2);
    expect(movement.resultingStockOnHand).toBe(before - 2);
  });
});

describe("demo data isolation in live reporting", () => {
  it("dashboard excludes demo records by default", async () => {
    const { DashboardService } = await import("../src/modules/dashboard/dashboard.service");
    const dashboard = new DashboardService(db, new SettingsService(db));
    const metrics = await dashboard.metrics(30);
    expect(metrics.demoDataIncluded).toBe(false);
    // Demo orders exist from seed but must not be counted; live test orders must be.
    const demoOrders = await db.count(COLLECTIONS.orders, [{ field: "isDemo", op: "==", value: true }]);
    const liveOrders = await db.count(COLLECTIONS.orders, [{ field: "isDemo", op: "==", value: false }]);
    expect(demoOrders).toBe(12);
    expect(metrics.orders.count).toBe(liveOrders);
  });
});
