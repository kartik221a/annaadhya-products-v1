/**
 * Domain document types. Monetary amounts are integer paise.
 * Demo records carry `isDemo: true` + `seedBatch` so live data can always be separated.
 */
import type {
  AccountStatus,
  AdminRole,
  ContactEnquiryType,
  ExportJobStatus,
  InventoryMovementType,
  OrderStatus,
  PaymentProviderName,
  PaymentStatus,
  ProductStatus,
  PurchasePaymentMethod,
  PurchasePaymentStatus,
  PurchaseStatus,
  RefundStatus,
} from "./enums";

export interface BaseDoc {
  id: string;
  createdAt: number; // epoch millis (server time)
  updatedAt: number;
  isDemo: boolean;
  seedBatch?: string;
}

/* ---------------------------------- Catalogue --------------------------------- */

export interface CategoryDoc extends BaseDoc {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  sortOrder: number;
  isReady: boolean; // categories not ready are hidden from the storefront
  heroImage?: string;
  status: ProductStatus;
}

/** Category-specific compliance/spec line (label → value), e.g. "Moisture Level" → "18.2%". */
export interface ProductSpec {
  label: string;
  value: string;
}

/** What happens when tracked stock runs out for a product. */
export type BackorderPolicy = "deny" | "allow" | "notify";

export interface ProductDoc extends BaseDoc {
  sku: string; // unique, e.g. AN-HNY-001
  slug: string; // unique
  name: string;
  subtitle: string;
  description: string; // plain text or sanitised rich-text HTML (see sanitizeRichText in @annaadhya/utils)
  categoryId: string;
  typeLabel: string; // variety / type e.g. "Wild forest / multifloral honey"
  status: ProductStatus; // only `published` is publicly visible
  images: ProductImage[]; // ordered
  origin?: string; // terroir / geographical origin / sourcing estate
  shelfLife?: string; // free-text shelf life, e.g. "24 months from harvest"
  specs?: ProductSpec[]; // category-specific compliance & lab-testing lines
  ingredients?: string;
  netQuantityLabel?: string;
  storageInstructions?: string;
  allergenInfo?: string;
  manufacturerDetails?: string;
  fssaiLicense?: string; // only when business supplies it — never invented
  bestsellerRank?: number; // smaller = higher placement; drives "bestsellers"
  featuredRank?: number; // drives "featured products"
  giftItem: boolean;
  searchVisible?: boolean; // false = excluded from storefront search results (still reachable via category/direct link). Default true.
  trackInventory?: boolean; // false = sell without stock limits — no availability checks, reservations or decrements. Default true.
  backorderPolicy?: BackorderPolicy; // behaviour when tracked stock runs out. Default "deny".
  seo: { title?: string; description?: string };
}

/** Undefined-safe normalisers — all consumers must agree on defaults through these. */
export function searchVisibleOf(p: Pick<ProductDoc, "searchVisible">): boolean {
  return p.searchVisible !== false;
}
export function trackInventoryOf(p: Pick<ProductDoc, "trackInventory">): boolean {
  return p.trackInventory !== false;
}
export function backorderPolicyOf(p: Pick<ProductDoc, "backorderPolicy">): BackorderPolicy {
  return p.backorderPolicy ?? "deny";
}

/** Body for POST /admin/catalogue/products and POST /admin/catalogue/products/:id.
 *  Additive fields (slug/origin/shelfLife/specs) are optional and backward compatible:
 *  omitted slug keeps the existing/auto-generated slug; old clients never send them. */
export interface ProductUpsertPayload {
  sku: string;
  name: string;
  subtitle: string;
  description: string;
  categoryId: string;
  typeLabel: string;
  status: ProductStatus;
  images: ProductImage[];
  slug?: string; // custom storefront slug; omit to keep/auto-derive
  origin?: string;
  shelfLife?: string;
  specs?: ProductSpec[];
  ingredients?: string;
  netQuantityLabel?: string;
  storageInstructions?: string;
  allergenInfo?: string;
  manufacturerDetails?: string;
  fssaiLicense?: string;
  bestsellerRank?: number;
  featuredRank?: number;
  giftItem: boolean;
  seo: { title?: string; description?: string };
  variants: VariantUpsertPayload[];
}

export interface VariantUpsertPayload {
  id?: string;
  sku: string;
  packLabel: string;
  grams: number;
  pricePaise: number;
  mrpPaise?: number;
  status: ProductStatus;
  stockOnHand: number;
  lowStockThreshold: number;
  sortOrder?: number; // explicit display order (admin drag-reorder); missing → ordered by grams (legacy)
}

export interface ProductImage {
  url: string;
  cloudinaryPublicId?: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface ProductVariantDoc extends BaseDoc {
  productId: string;
  sku: string; // unique, e.g. AN-HNY-001-250G
  packLabel: string; // "250 g"
  grams: number; // numeric pack quantity in grams (0.5 g kesar => 0.5)
  pricePaise: number; // selling price (server-authoritative)
  mrpPaise?: number; // optional strike-through MRP
  status: ProductStatus;
  stockOnHand: number; // maintained transactionally
  reservedQty: number; // held for in-flight checkouts
  lowStockThreshold: number;
  sortOrder?: number; // explicit display order (admin drag-reorder); missing → ordered by grams (legacy)
}

export function availableQty(v: Pick<ProductVariantDoc, "stockOnHand" | "reservedQty">): number {
  return Math.max(0, v.stockOnHand - v.reservedQty);
}

/* ---------------------------------- Suppliers --------------------------------- */

/** Producer category of a supplier (drives the Suppliers console type filter/pill). */
export type SupplierType = "farmer_apiarist" | "estate_producer" | "wholesaler_coop" | "packaging_artisan" | "other";

/** Sourcing relationship state. Inactive ("seasonal pause") never deletes history —
 *  purchases keep their supplier linkage and stay fully reportable. */
export type SupplierStatus = "active" | "inactive";

/**
 * One negotiated procurement rate line. This is a PURCHASE cost the supplier
 * agreed to — never a customer-facing selling price (those live on variants).
 */
export interface SupplierRate {
  id: string;
  /** What the supplier calls the item, e.g. "Raw Wild Forest Honey (Grade-A bulk)". */
  label: string;
  /** Optional link into the real catalogue (product and/or variant). */
  productSku?: string;
  variantSku?: string;
  /** Negotiated purchase cost per unit, integer paise. */
  unitCostPaise: number;
  /** Unit of measurement the rate is quoted in: "kg", "g", "unit", "box"… */
  unit: string;
  /** Minimum order quantity in the same unit, when agreed. */
  moqQty?: number;
  notes?: string;
}

/**
 * Supplier record. All location/contact/type/status/rates fields are ADDITIVE and
 * optional-or-defaulted so pre-existing documents remain valid without migration:
 * legacy docs simply render with the fallbacks (type "other", status "active").
 */
export interface SupplierDoc extends BaseDoc {
  name: string;
  type?: SupplierType;
  contactPerson?: string;
  phone?: string;
  email?: string;
  /** Legacy free-text location ("Nadia, West Bengal"). Kept for old records. */
  location?: string;
  village?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressLines?: string;
  status?: SupplierStatus;
  paymentTerms?: string;
  /** FSSAI / NABL / GI licence reference, when the business supplies it. */
  licenseNumber?: string;
  notes?: string;
  productSkus: string[];
  rates?: SupplierRate[];
}

/** Sort keys for the Suppliers console. */
export type SupplierSort = "recently_added" | "name_asc" | "recent_purchase" | "value_desc";
export type SupplierStatusFilter = "all" | "active" | "inactive";

/**
 * One Suppliers-console row: the supplier joined with REAL purchase history derived
 * from the purchases collection (last consignment, lifetime value) and catalogue
 * category context. Nothing here is invented — missing purchases stay null.
 */
export interface SupplierLedgerRow {
  id: string;
  name: string;
  type: SupplierType;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  location?: string; // effective display location (city/state composed or legacy)
  status: SupplierStatus;
  village?: string;
  pincode?: string;
  paymentTerms?: string;
  licenseNumber?: string;
  notes?: string;
  productSkus: string[];
  rates: SupplierRate[];
  /** Distinct catalogue categories covered by the supplier's product links. */
  categoryNames: string[];
  createdAt: number;
  updatedAt: number;
  /* --- derived from real purchase records (null when none exist) --- */
  purchaseCount: number;
  lastPurchaseAt: number | null;
  lastPurchaseReference: string | null;
  lastPurchaseValuePaise: number | null;
  totalPurchaseValuePaise: number;
}

/** Summary metrics computed over the SAME filtered scope as the rows. */
export interface SupplierLedgerSummary {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  /** Distinct catalogue categories linked across the filtered suppliers. */
  categoryCount: number;
  /** Suppliers created inside the current calendar month (IST). */
  addedThisMonth: number;
  /** Suppliers with at least one real purchase recorded. */
  withPurchases: number;
}

export interface SupplierLedgerPage {
  items: SupplierLedgerRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: SupplierLedgerSummary;
}

/**
 * One purchase-order line. Snapshot fields (productName, variantPackLabel) preserve
 * catalogue context so historical purchases stay meaningful when the catalogue later
 * changes; qtyReceived is maintained server-side through receiving events only.
 */
export interface PurchaseItem {
  variantSku: string;
  description: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostPaise: number; // actual landed unit cost when known
  /** Measurement label the line is counted in ("unit", "box", "kg"…). Additive. */
  unit?: string;
  /** Line-level discount, integer paise (never negative). Additive. */
  discountPaise?: number;
  /** Line-level tax percent (GST slab, 0–50). Additive. */
  taxPercent?: number;
  /** Authoritative line total (qty × cost − discount + tax), integer paise. Additive. */
  lineTotalPaise?: number;
  /* --- catalogue snapshots (additive; absent on legacy docs) --- */
  productId?: string;
  productName?: string;
  variantPackLabel?: string;
}

/** One persisted goods-receiving event. Immutable — corrections are future receipts, never edits. */
export interface PurchaseReceiptDoc {
  id: string; // client-generated idempotency key (persisted → replay-safe)
  receivedAt: number;
  receivedByUid: string;
  receivedByName?: string;
  lines: { variantSku: string; qty: number; unit?: string }[];
  /** Free-text consignment condition / storage note recorded by the operator. */
  note?: string;
  /** Inventory movement ids created by this receipt (audit linkage). */
  movementIds: string[];
}

/** One recorded supplier payment against a purchase (real ledger entry — never inferred). */
export interface PurchasePaymentDoc {
  id: string;
  amountPaise: number;
  method: PurchasePaymentMethod;
  /** UTR / cheque no. / transaction proof reference. */
  reference?: string;
  paidAt: number;
  recordedByUid: string;
  recordedByName?: string;
  note?: string;
}

export interface PurchaseDoc extends BaseDoc {
  supplierId: string;
  reference: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  notes?: string;
  createdByUid: string;
  /* --- procurement metadata (additive, optional-or-absent on legacy docs) --- */
  /** Business date of the purchase (defaults to createdAt when absent). */
  purchaseDate?: number;
  expectedDeliveryDate?: number | null;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: number | null;
  internalNotes?: string;
  /** Staff display name captured at creation (uid stays in createdByUid). */
  createdByName?: string;
  /* --- authoritative money (server-computed; legacy docs fall back to items math) --- */
  subTotalPaise?: number;
  discountTotalPaise?: number;
  taxTotalPaise?: number;
  totalPaise?: number;
  /* --- settlement (derived from real payment records only) --- */
  paidPaise?: number;
  paymentStatus?: PurchasePaymentStatus;
  payments?: PurchasePaymentDoc[];
  /* --- receiving history (append-only; never rewritten) --- */
  receipts?: PurchaseReceiptDoc[];
  confirmedAt?: number | null;
  cancelledAt?: number | null;
  cancelReason?: string;
}

/** Sort keys for the Purchases console. */
export type PurchaseSort = "recent_first" | "oldest_first" | "value_desc";
export type PurchaseStatusFilter = "all" | PurchaseStatus;
export type PurchasePaymentStatusFilter = "all" | PurchasePaymentStatus;

/**
 * One Purchases-console row: the purchase joined with supplier display data and
 * server-computed money. Legacy docs without totals fall back to item math.
 */
export interface PurchaseLedgerRow {
  id: string;
  reference: string;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  supplierId: string;
  purchaseDate: number;
  expectedDeliveryDate: number | null;
  supplierInvoiceNumber?: string;
  supplierName: string;
  supplierLocation?: string;
  supplierStatus: SupplierStatus;
  itemCount: number;
  /** First line description(s) for the table's items cell. */
  itemsPreview: string;
  orderedUnits: number;
  receivedUnits: number;
  unitLabel: string;
  subTotalPaise: number;
  discountTotalPaise: number;
  taxTotalPaise: number;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
}

/** Summary metrics computed over the SAME filtered scope as the rows. */
export interface PurchaseLedgerSummary {
  totalPurchases: number;
  draftCount: number;
  orderedCount: number;
  partiallyReceivedCount: number;
  /** Pending deliveries = ordered + partially received. */
  pendingDeliveries: number;
  goodsReceived: number;
  cancelledCount: number;
  /** Σ total of committed (non-draft, non-cancelled) purchases in scope — never double-counts receipts or payments. */
  spendPaise: number;
  /** Σ recorded payments against committed purchases in scope. */
  paidPaise: number;
  outstandingPaise: number;
  /** Most urgent pending consignment in scope (partially received first, then earliest due). */
  priority: {
    id: string;
    reference: string;
    supplierName: string;
    outstandingUnits: number;
    unitLabel: string;
    expectedDeliveryDate: number | null;
    partiallyReceived: boolean;
  } | null;
}

export interface PurchaseLedgerPage {
  items: PurchaseLedgerRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: PurchaseLedgerSummary;
}

/* ---------------------------------- Customers --------------------------------- */

export interface CustomerDoc extends BaseDoc {
  uid: string; // Firebase UID (stable key)
  displayName: string;
  email?: string;
  phone?: string;
  providers: string[]; // ["google", "password", "phone"]
  accountStatus: AccountStatus;
  defaultAddressId?: string;
  addresses: CustomerAddress[];
  notes?: string; // internal support notes, admin-visible only
  marketingOptIn: boolean;
}

/* --------------------------- Customers directory (admin) -------------------------- */

/** Order-activity filter for the admin customer directory. */
export type CustomerActivityFilter = "all" | "with_orders" | "no_orders" | "repeat";

/** Sort keys for the admin customer directory. */
export type CustomerDirectorySort =
  | "spend_desc" // highest completed spend first (directory default)
  | "orders_desc" // most real orders first
  | "recent_order" // most recent real order first
  | "recent_registered" // newest account first
  | "name_asc"; // display name A→Z

/**
 * One admin-directory row: the customer record joined with metrics computed from
 * real orders. Metric definitions (single source of truth — the directory list,
 * the summary cards, the detail drawer and the XLSX export all share them):
 *  - `orderCount`        — "real" orders: any persisted order that entered the
 *                          fulfilment lifecycle (status ≠ pending_payment, or a
 *                          pending_payment order whose payment actually succeeded).
 *                          Ghost orders (created but payment failed/abandoned) never count.
 *  - `completedOrderCount`— subset of real orders that contribute to spend.
 *  - `totalSpendPaise`   — NET completed spend = Σ(totalPaise − refundPaise) over
 *                          completed orders: online orders with paymentStatus
 *                          "succeeded" that are not cancelled/refunded, plus COD
 *                          orders that reached "delivered" (money actually collected).
 *                          Pending, failed, cancelled and refunded orders never count.
 *  - `lastOrder*`        — most recent real order (by createdAt), any status.
 */
export interface CustomerDirectoryRow extends CustomerDoc {
  orderCount: number;
  completedOrderCount: number;
  totalSpendPaise: number;
  lastOrderAt?: number;
  lastOrderId?: string;
  lastOrderNumber?: string;
}

/** Summary cards for the directory — computed over the SAME filtered cohort the table lists. */
export interface CustomerDirectorySummary {
  /** Distinct customer records in the cohort (equals the pagination total). */
  totalCustomers: number;
  /** Accounts whose createdAt falls in the "new" window (this IST month by default). */
  newCustomers: number;
  /** Honest label for the new-customers window, e.g. "this month" / "in the selected range". */
  newCustomersWindow: string;
  /** Cohort members with ≥ 1 real order. */
  customersWithOrders: number;
  /** Cohort members with ≥ 2 real orders. */
  repeatCustomers: number;
  /** Σ completed spend across the cohort (paise). */
  lifetimeSpendPaise: number;
  /** Mean real orders per repeat patron; null when the cohort has no repeat patrons. */
  avgOrdersPerRepeat: number | null;
}

export interface CustomerDirectoryPage {
  items: CustomerDirectoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: CustomerDirectorySummary;
}

export interface CustomerAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string; // 6 digits
  isDefault: boolean;
}

/* ------------------------------ Newsletter ------------------------------------ */

/** Marketing list captured by the storefront newsletter form (public, unauthenticated). */
export interface NewsletterSubscriberDoc extends BaseDoc {
  email: string; // normalized lowercase; unique per list (deterministic doc id)
  status: "active" | "unsubscribed";
  source: string; // capture surface, e.g. "footer" | "homepage-hero" | "api"
  customerUid?: string; // set when the subscriber was signed in at capture time
  unsubscribedAt?: number; // epoch millis; set by the (future) unsubscribe workflow
}

/** Storefront contact-form submission (public, unauthenticated, rate-limited).
 *  Doc id is deterministic from (email, clientRef) — retries never duplicate.
 *  There is no email-delivery provider configured; persistence + the audit-log
 *  entry ARE the delivery workflow until a provider is approved. */
export interface ContactMessageDoc extends BaseDoc {
  fullName: string;
  email: string; // normalized lowercase
  enquiryType: ContactEnquiryType;
  orderNumber?: string; // optional, format-loose (letters/digits/dashes)
  subject?: string;
  message: string;
  customerUid?: string; // set when the sender was signed in at submission time
}

/* ------------------------------------ Orders ---------------------------------- */

export interface OrderDoc extends BaseDoc {
  orderNumber: string; // human-friendly, e.g. AN-2026-000123
  customerUid?: string; // null for guest checkout
  customerContact: { displayName: string; email: string; phone: string };
  shippingAddress: CustomerAddress;
  items: OrderItemSnapshot[];
  subtotalPaise: number;
  discountTotalPaise: number;
  shippingPaise: number;
  taxLabel?: string; // only rendered when configured — never invented
  taxPaise: number;
  totalPaise: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProviderName;
  refundStatus: RefundStatus;
  refundPaise: number;
  tracking?: { carrier: string; trackingNumber: string; updatedAt: number };
  cancelledReason?: string;
  isGiftOrder: boolean;
}

/** Historical snapshot — orders keep the exact name/price/sku at purchase time. */
export interface OrderItemSnapshot {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  variantLabel: string;
  image?: string;
  unitPricePaise: number; // actual charged price
  mrpPaise?: number;
  qty: number;
  lineTotalPaise: number;
  backorderedQty?: number; // qty not covered by stock — present only when the backorder policy allowed the sale
}

/**
 * Internal staff note attached to an order (admin-visible only, never customer-facing).
 * Written through POST /admin/orders/:id/notes with the orders:write permission; every
 * create is audited. Notes are a separate collection — the customer order endpoints
 * return OrderDoc, which carries no notes field, so internal content cannot leak.
 */
export interface OrderNoteDoc extends BaseDoc {
  orderId: string;
  orderNumber: string;
  note: string;
  authorUid: string;
  authorName: string;
  authorRole: AdminRole | "system";
}

/* ------------------------------ Payments & checkout --------------------------- */

export interface PaymentAttemptDoc extends BaseDoc {
  orderId: string;
  orderNumber: string;
  provider: PaymentProviderName;
  providerOrderId?: string;
  status: PaymentStatus;
  amountPaise: number;
  attempts: number;
  lastError?: string;
  refundPaise: number;
  idempotencyKey?: string;
}

export interface CheckoutQuoteDoc extends BaseDoc {
  quoteId: string;
  items: { variantId: string; qty: number; unitPricePaise: number; lineTotalPaise: number; backorderedQty?: number }[];
  subtotalPaise: number;
  discountTotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  pincode?: string;
  expiresAt: number;
  consumed: boolean;
  unavailable: { variantId: string; reason: string }[];
}

export interface StockReservationDoc extends BaseDoc {
  orderId: string;
  variantId: string;
  qty: number;
  status: "active" | "committed" | "released";
  expiresAt: number;
}

/* ---------------------------------- Inventory --------------------------------- */

export interface InventoryMovementDoc extends BaseDoc {
  variantId: string;
  variantSku: string;
  type: InventoryMovementType;
  qtyDelta: number; // signed change to stockOnHand
  reservedDelta: number; // signed change to reservedQty
  resultingStockOnHand: number;
  resultingReservedQty: number;
  reason: string; // mandatory for every adjustment
  referenceType?: string; // e.g. "purchase", "order", "admin"
  referenceId?: string;
  performedByUid?: string;
  performedByName?: string;
}

/** Derived stock health of a variant. `available <= 0` is out of stock; `<= threshold` is low. */
export type InventoryStockStatus = "in_stock" | "low_stock" | "out_of_stock";

/** One inventory-console row: variant balance joined with product/category display data. */
export interface InventoryLedgerRow {
  variantId: string;
  sku: string;
  packLabel: string;
  productId: string;
  productName: string;
  productSlug?: string;
  productImage?: string;
  categoryName: string;
  variantStatus: ProductStatus;
  productStatus: ProductStatus;
  stockOnHand: number;
  reservedQty: number;
  available: number;
  lowStockThreshold: number;
  pricePaise: number;
  updatedAt: number;
  stockStatus: InventoryStockStatus;
  /** Latest ledger event for this variant, when one exists (drives "last adjusted"). */
  lastMovement: { at: number; byName?: string; type: InventoryMovementType } | null;
}

/**
 * Summary metrics over the SAME filtered scope as the ledger table.
 * `retailValuePaise` is stock × selling price — the platform has no unit-cost
 * valuation, so the UI must never present this as cost value.
 */
export interface InventoryLedgerSummary {
  totalVariants: number;
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  totalStockOnHand: number;
  retailValuePaise: number;
}

export interface InventoryLedgerPage {
  items: InventoryLedgerRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: InventoryLedgerSummary;
}

/* ---------------------------------- Expenses ---------------------------------- */

export interface ExpenseDoc extends BaseDoc {
  date: number;
  category: string; // free-form but validated non-empty; e.g. "packaging", "freight"
  amountPaise: number;
  description: string;
  payee?: string;
  reference?: string;
  attachmentUrl?: string;
  createdByUid: string;
  createdByName?: string;
}

/* ---------------------------------- Team & audit ------------------------------- */

export interface AdminUserDoc extends BaseDoc {
  uid: string; // Firebase UID of the staff member
  displayName: string;
  email: string;
  role: AdminRole;
  status: AccountStatus;
  invitedByUid?: string;
  lastLoginAt?: number;
}

export interface AuditLogDoc extends BaseDoc {
  actorUid: string;
  actorName: string;
  actorRole: AdminRole | "customer" | "system";
  action: string; // e.g. "product.update", "order.status_change", "payment.webhook"
  targetType?: string;
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookEventDoc extends BaseDoc {
  provider: PaymentProviderName;
  eventId: string; // provider event id — idempotency key for callbacks
  eventType: string;
  processedAt?: number;
  result?: "applied" | "duplicate" | "ignored" | "error";
  error?: string;
  payloadDigest: string;
}

export interface ExportJobDoc extends BaseDoc {
  type: string;
  status: ExportJobStatus;
  requestedByUid: string;
  filters: Record<string, unknown>;
  rowEstimate: number;
  fileUrl?: string; // short-lived authorised download link (when async)
  expiresAt?: number;
  error?: string;
}

/* ---------------------------------- Settings ---------------------------------- */

export interface SettingsDoc {
  id: "global";
  updatedAt: number;
  store: {
    name: string;
    legalName: string;
    supportEmail: string;
    supportPhone: string;
    addressLines: string[]; // used only where the business chooses to show it
    gstin?: string; // intentionally blank until the business supplies it
    fssaiLicense?: string;
    socialLinks: { instagram?: string; facebook?: string; whatsapp?: string };
    announcement: { enabled: boolean; message: string; href?: string };
  };
  shipping: {
    mode: "flat_rate" | "free_shipping" | "disabled";
    flatRatePaise: number;
    freeAbovePaise: number | null;
    deliveryEstimateDays: [number, number] | null; // shown only when configured
    serviceablePincodesNote: string;
  };
  payments: {
    provider: PaymentProviderName;
    sandboxMode: boolean; // stays true until owner explicitly approves launch
    codEnabled: boolean;
    upiNote?: string;
  };
  reporting: {
    includeDemoDataByDefault: boolean; // false: live reporting excludes demo records
  };
  storefront: {
    heroHeadline: string;
    heroSubcopy: string;
    heroImage?: string;
    heroCtaHref: string;
    heroCtaLabel?: string;
    newsletterEnabled: boolean; // only when a compliant workflow exists
    giftCollectionEnabled: boolean;
  };
}

export interface AppSettings {
  settings: SettingsDoc;
}

/** Whitelisted projection of SettingsDoc for public storefront consumption
 *  (GET /settings/public). Never includes GSTIN, licences, payment internals
 *  or reporting flags — only what the storefront is allowed to render. */
export interface PublicStoreSettings {
  store: {
    name: string;
    supportEmail: string;
    supportPhone: string;
    addressLines: string[];
    socialLinks: { instagram?: string; facebook?: string; whatsapp?: string };
    announcement: { enabled: boolean; message: string; href?: string };
  };
  storefront: {
    newsletterEnabled: boolean;
    giftCollectionEnabled: boolean;
    /** Owner-controlled hero copy. Empty string means "use the approved design
     *  default" — the storefront falls back to its curated hero when blank. */
    heroHeadline: string;
    heroSubcopy: string;
    heroImage?: string;
    heroCtaHref: string;
    heroCtaLabel?: string;
  };
  /** Public shipping policy — powers honest cart-page shipping messaging.
   *  Delivery estimates stay private until confirmed (see SettingsDoc). */
  shipping: {
    mode: "flat_rate" | "free_shipping" | "disabled";
    flatRatePaise: number;
    freeAbovePaise: number | null;
  };
}
