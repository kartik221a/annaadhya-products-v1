/** Formatting helpers (client-safe mirrors of @annaadhya/utils behaviour). */

export function formatINR(paise: number, withDecimals = true): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const rupeeStr = rupees.toLocaleString("en-IN");
  return negative
    ? `-₹${rupeeStr}${withDecimals ? `.${String(rem).padStart(2, "0")}` : ""}`
    : `₹${rupeeStr}${withDecimals ? `.${String(rem).padStart(2, "0")}` : ""}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatDateIN(millis: number): string {
  return new Date(millis).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function minVariantPricePaise(variants: { pricePaise: number }[]): number {
  return Math.min(...variants.map((v) => v.pricePaise));
}

export function availableQty(v: { stockOnHand: number; reservedQty: number }): number {
  return Math.max(0, v.stockOnHand - v.reservedQty);
}
