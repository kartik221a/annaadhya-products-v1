/**
 * Client-side zod mirrors of the server DTOs (packages/contracts/src/dto/admin.ts).
 * The API always re-validates; these give the admin instant, offline feedback with the
 * exact same rules before a request is spent.
 */
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const skuSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9\-_.]{2,40}$/, "SKU must be 3-41 chars: A-Z, 0-9, dashes");

export const productImageSchema = z.object({
  url: z.string().url().max(600),
  cloudinaryPublicId: z.string().max(200).optional(),
  alt: z.string().trim().max(160),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

export const variantUpsertSchema = z.object({
  id: idSchema.optional(),
  sku: skuSchema,
  packLabel: z.string().trim().min(1).max(40),
  grams: z.number().positive().max(1_000_000),
  pricePaise: z
    .number()
    .int()
    .min(0)
    .max(99_999_999_999)
    .refine((v) => v > 0, "Selling price must be greater than zero"),
  mrpPaise: z.number().int().min(0).max(99_999_999_999).optional(),
  status: z.enum(["draft", "published", "archived"]),
  stockOnHand: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(100_000),
});

export const productUpsertSchema = z.object({
  sku: skuSchema,
  name: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(180),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(8000),
  categoryId: idSchema,
  typeLabel: z.string().trim().max(120),
  status: z.enum(["draft", "published", "archived"]),
  images: z.array(productImageSchema).max(10),
  ingredients: z.string().trim().max(2000).optional(),
  netQuantityLabel: z.string().trim().max(80).optional(),
  storageInstructions: z.string().trim().max(1000).optional(),
  allergenInfo: z.string().trim().max(500).optional(),
  manufacturerDetails: z.string().trim().max(500).optional(),
  fssaiLicense: z.string().trim().max(80).optional(),
  bestsellerRank: z.number().int().min(1).max(1000).optional(),
  featuredRank: z.number().int().min(1).max(1000).optional(),
  giftItem: z.boolean(),
  seo: z.object({
    title: z.string().trim().max(180).optional(),
    description: z.string().trim().max(320).optional(),
  }),
  variants: z.array(variantUpsertSchema).max(20),
});

/** Format zod issues into the flat list the product form renders. */
export function zodErrorList(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.filter((p) => p !== "").join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
