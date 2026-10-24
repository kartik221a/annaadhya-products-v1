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

export interface SupplierDoc extends BaseDoc {
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  notes?: string;
  productSkus: string[];
}

export interface PurchaseDoc extends BaseDoc {
  supplierId: string;
  reference: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  notes?: string;
  createdByUid: string;
}

export interface PurchaseItem {
  variantSku: string;
  description: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostPaise: number; // actual landed unit cost when known
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
