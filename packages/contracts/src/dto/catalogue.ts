/** Zod DTO schemas for public catalogue + checkout endpoints. */
import { z } from "zod";
import { paiseSchema, quantitySchema } from "@annaadhya/utils";
import { CONTACT_ENQUIRY_TYPES, type ContactEnquiryType } from "../enums";

export { CONTACT_ENQUIRY_TYPES, type ContactEnquiryType };

/** Query params are always strings — coerce to a number before the paise bounds check.
 *  (A bare paiseSchema rejects the string form, which silently broke price filtering.) */
const paiseQueryParam = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), paiseSchema);

export const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(96).optional(), // category slug
  minPricePaise: paiseQueryParam.optional(),
  maxPricePaise: paiseQueryParam.optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  // NOTE: z.coerce.boolean() treats the string "false" as true — parse explicitly instead.
  includeUnavailable: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
});
export type ListQueryDto = z.infer<typeof listQuerySchema>;

export const checkoutItemSchema = z.object({
  variantId: z.string().min(1).max(128),
  qty: quantitySchema,
});

export const checkoutQuoteSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "Cart is empty").max(50),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .optional(),
});

export type CheckoutQuoteDto = z.infer<typeof checkoutQuoteSchema>;

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(48).default("Home"),
  fullName: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  line1: z.string().trim().min(3, "Address line 1 is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
});
export type AddressDto = z.infer<typeof addressSchema>;

export const PAYMENT_METHODS = ["gateway", "cod"] as const;
export const createOrderSchema = z.object({
  quoteId: z.string().min(6).max(128),
  paymentMethod: z.enum(PAYMENT_METHODS).default("gateway"),
  customer: z.object({
    displayName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(160).or(z.literal("")),
    phone: z
      .string()
      .trim()
      .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  }),
  address: addressSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

/** Saved delivery address for an authenticated customer's own profile (customers/me/addresses). */
export const savedAddressSchema = z.object({
  label: z.string().trim().min(1).max(48).default("Home"),
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  line1: z.string().trim().min(3, "Flat / House no. / Building is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  isDefault: z.boolean().default(false),
});
export type SavedAddressDto = z.infer<typeof savedAddressSchema>;
export const savedAddressIdSchema = z.object({ addressId: z.string().min(4).max(64) });

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number")
    .optional()
    .or(z.literal("")),
  marketingOptIn: z.boolean().optional(),
});
export type ProfileUpdateDto = z.infer<typeof profileUpdateSchema>;

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address" }).max(254),
  source: z.string().trim().max(40).optional(),
});
export type NewsletterSubscribeDto = z.infer<typeof newsletterSubscribeSchema>;

/* --------------------------------- Contact ---------------------------------- */

/**
 * Public contact-form submission. `clientRef` is generated once per composed
 * message in the browser and makes retries idempotent: the backend derives a
 * deterministic document id from (email, clientRef), so a network-timeout retry
 * converges on the same document instead of creating a duplicate.
 */
export const contactMessageSchema = z.object({
  clientRef: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid message reference"),
  fullName: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address" }).max(254),
  enquiryType: z.enum(CONTACT_ENQUIRY_TYPES),
  orderNumber: z
    .string()
    .trim()
    .max(20, "Order number looks too long")
    .regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please tell us a little more (at least 10 characters)").max(2000),
});
export type ContactMessageDto = z.infer<typeof contactMessageSchema>;
