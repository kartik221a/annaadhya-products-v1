/** Client-safe types mirroring @annaadhya/contracts domain shapes (keeps the client bundle lean). */

export interface CategoryDoc {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  isReady: boolean;
  heroImage?: string;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  packLabel: string;
  grams: number;
  pricePaise: number;
  mrpPaise?: number;
  status: "draft" | "published" | "archived";
  stockOnHand: number;
  reservedQty: number;
  lowStockThreshold: number;
}

export interface ProductDoc {
  id: string;
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  categoryId: string;
  typeLabel: string;
  images: ProductImage[];
  ingredients?: string;
  netQuantityLabel?: string;
  storageInstructions?: string;
  allergenInfo?: string;
  manufacturerDetails?: string;
  bestsellerRank?: number;
  featuredRank?: number;
  giftItem: boolean;
  seo?: { title?: string; description?: string };
}

export type ProductWithVariantsShape = ProductDoc & { variants: ProductVariant[] };

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CheckoutQuote {
  quoteId: string;
  items: { variantId: string; qty: number; unitPricePaise: number; lineTotalPaise: number }[];
  subtotalPaise: number;
  discountTotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  unavailable: { variantId: string; reason: string }[];
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  items: { name: string; variantLabel: string; qty: number; lineTotalPaise: number; image?: string }[];
  createdAt: number;
  shippingAddress?: { fullName: string; line1: string; city: string; pincode: string };
  customerPaymentPayload?: Record<string, unknown>;
}

export interface CustomerDoc {
  id: string;
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  addresses: {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }[];
}

export interface Principal {
  uid: string;
  email?: string;
  displayName?: string;
  role: string;
  isStaff: boolean;
}
