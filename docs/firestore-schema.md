# Firestore schema

Collections, document shapes and the query patterns they support. All monetary values are integer
paise. Timestamps are epoch-millis integers set by the trusted backend.

## Demo data boundary

Documents created by the seed tool or catalogue importer carry:

- `isDemo: true`
- `seedBatch: "demo-2026-10-19"` (or the importing batch id)

Rules enforced across the platform:

- reporting excludes `isDemo` records unless `settings.reporting.includeDemoDataByDefault` is true
- Excel exports label demo sheets and exclude demo data by default
- `reset-demo` deletes **only** documents where `isDemo == true`
- live documents never get `isDemo` set; tools treat `isDemo != true` as live and refuse to overwrite

## Collections

### products
| Field | Type | Notes |
|---|---|---|
| id | string | deterministic for seeds/imports (`prod_<sku-derived>`) |
| sku | string | unique business key (AN-HNY-001) |
| slug | string | unique, URL-safe |
| name, subtitle, description | string | draft copy pending supplier verification |
| categoryId | string | → categories |
| typeLabel | string | variety/type |
| status | draft \| published \| archived | only `published` is public |
| images | ProductImage[] | ordered; url/cloudinaryPublicId/alt |
| ingredients, netQuantityLabel, storageInstructions, allergenInfo, manufacturerDetails, fssaiLicense | string? | shown only when the business supplies them |
| bestsellerRank, featuredRank | number? | drive home-page placement |
| giftItem | boolean | |
| seo | { title?, description? } | |
| createdAt, updatedAt, isDemo, seedBatch | | |

### productVariants
| Field | Type | Notes |
|---|---|---|
| productId | string | → products |
| sku | string | unique (AN-HNY-001-250G) |
| packLabel | string | "250 g" |
| grams | number | 0.5 for kesar half-gram |
| pricePaise | number | server-authoritative selling price |
| mrpPaise | number? | only when business supplies it |
| status | draft \| published \| archived | |
| stockOnHand | number | transactionally maintained |
| reservedQty | number | held for in-flight checkouts |
| lowStockThreshold | number | drives alerts |

### categories
slug (unique), name, tagline, description, sortOrder, `isReady` (categories without stock are
hidden), heroImage?, status.

### orders
orderNumber (`AN-2026-000123`), customerUid?, customerContact, shippingAddress,
`items[]` (full snapshot: sku, name, variantLabel, unitPricePaise, mrpPaise, qty, lineTotalPaise),
subtotalPaise, discountTotalPaise, shippingPaise, taxPaise (+taxLabel when configured), totalPaise,
status, paymentStatus, paymentProvider, refundStatus, refundPaise, tracking?, cancelledReason?.

**Snapshots are immutable** — historical orders keep the exact names/prices purchased even if the
catalogue changes later.

### paymentAttempts
orderId, provider, providerOrderId?, status (state machine: created→pending→succeeded/failed/
cancelled; succeeded→refunded), amountPaise, attempts, lastError?, refundPaise.

### checkoutQuotes
quoteId, items (server-priced lines), totals, unavailable[], pincode?, expiresAt, `consumed`.
Single-use; checked-and-consumed inside a transaction.

### stockReservations
orderId, variantId, qty, status (active|committed|released), expiresAt.

### inventoryMovements
variantId, variantSku, type (received|sold|damaged|manual_adjustment|returned|reserved|released|
other), qtyDelta, reservedDelta, resultingStockOnHand, resultingReservedQty, **reason** (mandatory),
referenceType/referenceId, performedByUid/Name.

### customers
uid (Firebase UID, stable key), displayName, email?, phone?, providers[], accountStatus,
addresses[] (labelled Indian addresses with 6-digit pincode), defaultAddressId?, notes? (internal),
marketingOptIn.

### suppliers / purchases
Suppliers: name, phone?, email?, location?, notes?, productSkus[].
Purchases: supplierId, reference, status (draft|ordered|partially_received|received|cancelled),
items[] (variantSku, description, qtyOrdered, qtyReceived, unitCostPaise — actual landed costs),
createdByUid.

### expenses
date, category, amountPaise, description, payee?, reference?, attachmentUrl?, createdByUid/Name.

### adminUsers
uid (Firebase UID), displayName, email, role (owner|manager|inventory|orders_support|reports),
status (active|suspended), invitedByUid?, lastLoginAt?.

### auditLogs
actorUid, actorName, actorRole, action (`product.update`, `order.status_change`,
`payment.webhook.razorpay`, …), targetType/targetId, summary, metadata?. Append-only.

### settings (singleton: `global`)
store (name, legalName, supportEmail/Phone, addressLines, gstin?, fssaiLicense?, socialLinks,
announcement), shipping (mode, flatRatePaise, freeAbovePaise, deliveryEstimateDays?,
serviceablePincodesNote), payments (provider, `sandboxMode` — stays true until explicit owner
approval, codEnabled), reporting (includeDemoDataByDefault), storefront (hero copy, newsletter and
gift flags — both default off until compliant workflows exist).

### webhookEvents / counters / exportJobs
Provider event idempotency; per-year order-number counters; async export tracking.

## Security rules

See `firestore.rules` at the repo root. Principle: **default deny**. The trusted backend (Admin
SDK) bypasses rules by design, so rules exist to block *direct client access* to business
collections. Only `customers/{uid}` self-doc access is allowed for profile convenience, and even
that is mirrored server-side.

Deploy with:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Indexes

Query patterns used by the API are declared in `firestore.indexes.json`:

- products: `status ASC, createdAt DESC`; `categoryId ASC, status ASC`
- productVariants: `productId ASC, grams ASC`; `sku ASC`
- orders: `customerUid ASC, createdAt DESC`; `status ASC, createdAt DESC`; `createdAt ASC` (ranges)
- paymentAttempts: `providerOrderId ASC`; `orderId ASC`
- inventoryMovements: `variantId ASC, createdAt DESC`; `type ASC, createdAt DESC`
- checkoutQuotes: `expiresAt ASC`
- stockReservations: `orderId ASC`; `status ASC, expiresAt ASC`
- webhookEvents: `eventId ASC`
- adminUsers: `uid ASC`; `role ASC`
- auditLogs: `createdAt DESC`
- expenses: `date DESC`; `category ASC, date DESC`
