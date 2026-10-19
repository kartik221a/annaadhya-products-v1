import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const statics: MetadataRoute.Sitemap = [
    "", "/shop", "/about", "/contact", "/faq",
    "/policies/shipping", "/policies/returns", "/policies/privacy", "/policies/terms",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  const categories = await getCategories();
  const categoryUrls: MetadataRoute.Sitemap = categories
    .filter((c) => c.isReady)
    .map((c) => ({
      url: `${base}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const products = await getProducts(new URLSearchParams({ pageSize: "48" }));
  const productUrls: MetadataRoute.Sitemap = (products?.items ?? []).map((p) => ({
    url: `${base}/product/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [...statics, ...categoryUrls, ...productUrls];
}
