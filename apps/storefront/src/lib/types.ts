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

/** Response of GET /categories/overview — categories + sellable counts in one roundtrip. */
export interface CategoryOverview {
  categories: Array<CategoryDoc & { productCount: number }>;
  totalProducts: number;
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
  sortOrder?: number;
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
  searchVisible?: boolean; // false = hidden from storefront search results
  trackInventory?: boolean; // false = sold without stock limits
  backorderPolicy?: "deny" | "allow" | "notify"; // behaviour when tracked stock runs out
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
  items: { variantId: string; qty: number; unitPricePaise: number; lineTotalPaise: number; backorderedQty?: number }[];
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
  /** Real sign-in providers recorded by the API (google / password). Phone OTP is
   *  not offered on any storefront surface — this only mirrors the stored record. */
  providers?: string[];
  marketingOptIn?: boolean;
  /** Epoch millis — data-core stamps these on every stored doc. */
  createdAt?: number;
  updatedAt?: number;
  defaultAddressId?: string;
  addresses: {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    landmark?: string;
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

/** Whitelisted public projection of the global settings (GET /settings/public) —
 *  mirrors PublicStoreSettings from @annaadhya/contracts. Never contains GSTIN,
 *  licences or payment internals. */
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
    /** Owner-controlled hero copy. Empty string = the storefront renders its
     *  approved design default (mirrors PublicStoreSettings from contracts). */
    heroHeadline: string;
    heroSubcopy: string;
    heroImage?: string;
    heroCtaHref: string;
    heroCtaLabel?: string;
  };
  shipping: {
    mode: "flat_rate" | "free_shipping" | "disabled";
    flatRatePaise: number;
    freeAbovePaise: number | null;
  };
}
