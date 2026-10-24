/** Zod DTO schemas for admin/business endpoints. All enforce server-side validation. */
import { z } from "zod";
import { paiseSchema } from "@annaadhya/utils";
import { ADMIN_ROLES, INVENTORY_MOVEMENT_TYPES, PAYMENT_PROVIDERS } from "../enums";

const idSchema = z.string().trim().min(1).max(128);
const skuSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9\-_.]{2,40}$/, "SKU must be 3-41 chars: A-Z, 0-9, dashes");

/* ------------------------------------ Products ---------------------------------- */

/** Absolute https(s) URLs (Cloudinary) and site-rooted paths (/demo-images/…) are both real,
 *  supported image references — the demo catalogue ships with the latter. */
const imageUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine(
    (v) => /^https?:\/\/.+/i.test(v) || v.startsWith("/"),
    "Image URL must be absolute (https://…) or a site-rooted path (/demo-images/…)",
  );

export const productImageSchema = z.object({
  url: imageUrlSchema,
  cloudinaryPublicId: z.string().max(200).optional(),
  alt: z.string().trim().max(160).default(""),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

export const variantUpsertSchema = z.object({
  id: idSchema.optional(),
  sku: skuSchema,
  packLabel: z.string().trim().min(1).max(40),
  grams: z.number().positive().max(1_000_000),
  pricePaise: paiseSchema.refine((v) => v > 0, "Selling price must be greater than zero"),
  mrpPaise: paiseSchema.optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  stockOnHand: z.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type VariantUpsertDto = z.infer<typeof variantUpsertSchema>;

export const productUpsertSchema = z.object({
  sku: skuSchema,
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(180).default(""),
  // Description may be plain text or rich-text HTML — the API sanitises HTML on write
  // (see sanitizeRichText in @annaadhya/utils). HTML markup inflates length, so the cap is generous.
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(20000),
  categoryId: idSchema,
  typeLabel: z.string().trim().max(120).default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  images: z.array(productImageSchema).max(10).default([]),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and dashes")
    .min(3, "Slug must be at least 3 characters")
    .max(96)
    .optional(),
  origin: z.string().trim().max(200).optional(),
  shelfLife: z.string().trim().max(80).optional(),
  specs: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().max(200),
      }),
    )
    .max(12)
    .optional(),
  ingredients: z.string().trim().max(2000).optional(),
  netQuantityLabel: z.string().trim().max(80).optional(),
  storageInstructions: z.string().trim().max(1000).optional(),
  allergenInfo: z.string().trim().max(500).optional(),
  manufacturerDetails: z.string().trim().max(500).optional(),
  fssaiLicense: z.string().trim().max(80).optional(),
  bestsellerRank: z.number().int().min(1).max(1000).optional(),
  featuredRank: z.number().int().min(1).max(1000).optional(),
  giftItem: z.boolean().default(false),
  // Storefront controls — optional (not defaulted) so callers that omit them never reset
  // an existing doc; the service falls back to the stored value, then to the documented default.
  searchVisible: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  backorderPolicy: z.enum(["deny", "allow", "notify"]).optional(),
  seo: z
    .object({
      title: z.string().trim().max(180).optional(),
      description: z.string().trim().max(320).optional(),
    })
    .default({}),
  variants: z.array(variantUpsertSchema).max(20).default([]),
});
export type ProductUpsertDto = z.infer<typeof productUpsertSchema>;

export const categoryUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase-with-dashes")
    .max(96),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(180).default(""),
  description: z.string().trim().max(4000).default(""),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isReady: z.boolean().default(false),
  heroImage: z.string().url().max(600).optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});
export type CategoryUpsertDto = z.infer<typeof categoryUpsertSchema>;

/* ------------------------------------ Inventory ---------------------------------- */

export const stockMovementSchema = z.object({
  variantId: idSchema,
  type: z.enum(INVENTORY_MOVEMENT_TYPES),
  qty: z
    .number()
    .int()
    .refine((v) => v !== 0, "Quantity cannot be zero")
    .refine((v) => Math.abs(v) <= 1_000_000, "Quantity out of range"),
  reason: z.string().trim().min(3, "A reason is required for every stock movement").max(300),
  referenceType: z.string().trim().max(40).optional(),
  referenceId: z.string().trim().max(128).optional(),
});
export type StockMovementDto = z.infer<typeof stockMovementSchema>;

export const lowStockQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).max(100000).optional(),
});
export type LowStockQueryDto = z.infer<typeof lowStockQuerySchema>;

/* ------------------------------------ Suppliers ---------------------------------- */

export const supplierUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  productSkus: z.array(skuSchema).max(200).default([]),
});
export type SupplierUpsertDto = z.infer<typeof supplierUpsertSchema>;

export const purchaseUpsertSchema = z.object({
  supplierId: idSchema,
  reference: z.string().trim().min(2).max(60),
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]).default("draft"),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        variantSku: skuSchema,
        description: z.string().trim().max(200).default(""),
        qtyOrdered: z.number().int().min(1).max(1_000_000),
        qtyReceived: z.number().int().min(0).max(1_000_000).default(0),
        unitCostPaise: paiseSchema,
      }),
    )
    .min(1)
    .max(200),
});
export type PurchaseUpsertDto = z.infer<typeof purchaseUpsertSchema>;

/* ------------------------------------ Orders ---------------------------------- */

export const ORDER_STATUS_VALUES = [
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
  reason: z.string().trim().max(300).optional(),
  tracking: z
    .object({
      carrier: z.string().trim().min(1).max(80),
      trackingNumber: z.string().trim().min(3).max(80),
    })
    .optional(),
});
export type OrderStatusUpdateDto = z.infer<typeof orderStatusUpdateSchema>;

export const orderRefundSchema = z.object({
  amountPaise: paiseSchema.refine((v) => v > 0, "Refund amount must be positive"),
  reason: z.string().trim().min(3).max(300),
});
export type OrderRefundDto = z.infer<typeof orderRefundSchema>;

/** Admin correction of shipment tracking after the shipped transition (typo'd AWB, rebooked courier). */
export const orderTrackingUpdateSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  trackingNumber: z.string().trim().min(3).max(80),
});
export type OrderTrackingUpdateDto = z.infer<typeof orderTrackingUpdateSchema>;

/** Internal staff note (never customer-visible). Stored with author identity; audited on create. */
export const orderNoteCreateSchema = z.object({
  note: z.string().trim().min(2, "A note needs at least 2 characters").max(2000),
});
export type OrderNoteCreateDto = z.infer<typeof orderNoteCreateSchema>;

export const orderListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  paymentStatus: z.enum(["created", "pending", "succeeded", "failed", "cancelled", "refunded"]).optional(),
  paymentProvider: z.enum(PAYMENT_PROVIDERS).optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type OrderListQueryDto = z.infer<typeof orderListQuerySchema>;

/* ------------------------------------ Expenses ---------------------------------- */

export const expenseUpsertSchema = z.object({
  date: z.coerce.number().int().positive(),
  category: z.string().trim().min(2, "Category is required").max(60),
  amountPaise: paiseSchema.refine((v) => v > 0, "Expense amount must be positive"),
  description: z.string().trim().min(2).max(500),
  payee: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(120).optional(),
  attachmentUrl: z.string().url().max(600).optional(),
});
export type ExpenseUpsertDto = z.infer<typeof expenseUpsertSchema>;

/* -------------------------------------- Team ------------------------------------ */

export const teamInviteSchema = z.object({
  uid: z.string().trim().min(6).max(128),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: z.enum(ADMIN_ROLES),
});
export type TeamInviteDto = z.infer<typeof teamInviteSchema>;

export const teamRoleUpdateSchema = z.object({
  role: z.enum(ADMIN_ROLES),
});
export type TeamRoleUpdateDto = z.infer<typeof teamRoleUpdateSchema>;

export const teamStatusUpdateSchema = z.object({
  status: z.enum(["active", "suspended"]),
});
export type TeamStatusUpdateDto = z.infer<typeof teamStatusUpdateSchema>;

export const bootstrapOwnerSchema = z.object({
  uid: z.string().trim().min(6).max(128),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  setupKey: z.string().trim().min(8).max(200),
});
export type BootstrapOwnerDto = z.infer<typeof bootstrapOwnerSchema>;

/* ------------------------------------ Settings ---------------------------------- */

export const settingsUpdateSchema = z.object({
  store: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      legalName: z.string().trim().max(160).optional(),
      supportEmail: z.string().trim().email().optional().or(z.literal("")),
      supportPhone: z.string().trim().max(20).optional(),
      addressLines: z.array(z.string().trim().max(160)).max(5).optional(),
      gstin: z.string().trim().max(24).optional(),
      fssaiLicense: z.string().trim().max(80).optional(),
      socialLinks: z
        .object({
          instagram: z.string().trim().max(200).optional(),
          facebook: z.string().trim().max(200).optional(),
          whatsapp: z.string().trim().max(200).optional(),
        })
        .optional(),
      announcement: z
        .object({
          enabled: z.boolean().optional(),
          message: z.string().trim().max(160).optional(),
          href: z.string().trim().max(200).optional(),
        })
        .optional(),
    })
    .optional(),
  shipping: z
    .object({
      mode: z.enum(["flat_rate", "free_shipping", "disabled"]).optional(),
      flatRatePaise: paiseSchema.optional(),
      freeAbovePaise: paiseSchema.nullable().optional(),
      deliveryEstimateDays: z.array(z.number().int().min(0).max(60)).length(2).nullable().optional(),
      serviceablePincodesNote: z.string().trim().max(240).optional(),
    })
    .optional(),
  payments: z
    .object({
      provider: z.enum(["mock", "razorpay"]).optional(),
      sandboxMode: z.boolean().optional(),
      codEnabled: z.boolean().optional(),
      upiNote: z.string().trim().max(160).optional(),
    })
    .optional(),
  reporting: z
    .object({
      includeDemoDataByDefault: z.boolean().optional(),
    })
    .optional(),
  storefront: z
    .object({
      heroHeadline: z.string().trim().max(120).optional(),
      heroSubcopy: z.string().trim().max(240).optional(),
      heroImage: z.string().trim().max(600).optional(),
      heroCtaHref: z.string().trim().max(200).optional(),
      heroCtaLabel: z.string().trim().max(40).optional(),
      newsletterEnabled: z.boolean().optional(),
      giftCollectionEnabled: z.boolean().optional(),
    })
    .optional(),
});
export type SettingsUpdateDto = z.infer<typeof settingsUpdateSchema>;

/* ------------------------------------- Media ------------------------------------ */

export const mediaSignatureSchema = z.object({
  folder: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9\-_/]{1,80}$/, "Folder must be a simple path segment")
    .default("annaadhya/products"),
});
export type MediaSignatureDto = z.infer<typeof mediaSignatureSchema>;

export const mediaRegisterSchema = z.object({
  publicId: z.string().trim().min(1).max(200),
  url: z.string().url().max(600),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  bytes: z.number().int().positive().max(20 * 1024 * 1024).optional(),
});
export type MediaRegisterDto = z.infer<typeof mediaRegisterSchema>;
