/** API access — server components read the catalogue directly from the API; browsers use NEXT_PUBLIC_API_URL. */
import type {
  CategoryDoc,
  Page,
  ProductWithVariantsShape,
} from "./types";

export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000/api/v1";

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export async function apiGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate },
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<T>;
    return body.ok ? body.data ?? null : null;
  } catch {
    // API offline during build/preview — pages render their empty states.
    return null;
  }
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
    const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

export async function apiGetAuth<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${PUBLIC_API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  return json.data as T;
}

/* --------------------------- server-side catalogue --------------------------- */

export async function getCategories(): Promise<CategoryDoc[]> {
  return (await apiGet<CategoryDoc[]>("/categories", 120)) ?? [];
}

export async function getProducts(params: URLSearchParams): Promise<Page<ProductWithVariantsShape> | null> {
  return apiGet<Page<ProductWithVariantsShape>>(`/products?${params.toString()}`, 45);
}

export async function getProduct(slug: string): Promise<ProductWithVariantsShape | null> {
  return apiGet<ProductWithVariantsShape>(`/products/slug/${encodeURIComponent(slug)}`, 60);
}

export async function getBestsellers(): Promise<ProductWithVariantsShape[]> {
  return (await apiGet<ProductWithVariantsShape[]>("/products/bestsellers", 90)) ?? [];
}

export async function getFeatured(): Promise<ProductWithVariantsShape[]> {
  return (await apiGet<ProductWithVariantsShape[]>("/products/featured", 90)) ?? [];
}

export async function getPlatformStatus(): Promise<{
  mode: { dataProvider: string; authentication: string; payments: string; sandbox: boolean };
  paymentsSandbox: boolean;
  codEnabled: boolean;
} | null> {
  return apiGet("/auth/platform-status", 30);
}
