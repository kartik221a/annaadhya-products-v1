/**
 * Category-link hygiene for the storefront's navigation surfaces.
 *
 * The catalogue is the single source of truth for which category pages exist:
 * a category URL must only ever render when its category is PUBLISHED (the
 * same set the /category/[slug] route resolves — archived, draft and deleted
 * slugs are not in it). Every surface that renders a category link from
 * stored data (CMS navigation items, curated fallback menus, CMS homepage
 * overrides) prunes against this set, so archiving a category removes its
 * links from the navbar, footer and homepage within seconds — the client
 * never has to edit navigation options by hand.
 *
 * Fail-open by design: when the catalogue cannot be read (API offline during
 * a build/preview render) the published set is `null` and nothing is pruned —
 * an unreachable API must never empty the navbar.
 */

/** The exact set of category slugs that resolve to a real storefront page. */
export type PublishedCategorySlugs = Set<string> | null;

/**
 * Extract the category slug from a storefront URL — /category/{slug} only
 * (trailing slash tolerated; query/hash ignored). Returns null for every
 * other destination (home, shop, CMS pages, external URLs…), which callers
 * treat as "always keep".
 * Keep in sync with the same rule in apps/api navigation.service.resolveHref.
 */
export function categorySlugFromHref(href: string): string | null {
  const match = /^\/category\/([^/?#]+?)\/?$/.exec(href);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Drop entries whose href points at a category that is not in the published
 * set. Non-category hrefs always survive; a null set (catalogue unavailable)
 * skips pruning entirely.
 */
export function pruneDeadCategoryLinks<T extends { href: string }>(
  items: readonly T[],
  publishedSlugs: PublishedCategorySlugs,
): T[] {
  if (!publishedSlugs) return [...items];
  return items.filter((item) => {
    const slug = categorySlugFromHref(item.href);
    return slug === null || publishedSlugs.has(slug);
  });
}

/**
 * Resolve a stored "CTA" href (CMS homepage overrides and the like): if it
 * points at an unpublished category, fall back to a destination that always
 * exists. Non-category hrefs pass through untouched.
 */
export function safeCategoryHref(href: string, publishedSlugs: PublishedCategorySlugs, fallback: string): string {
  if (!publishedSlugs) return href;
  const slug = categorySlugFromHref(href);
  if (slug === null) return href;
  return publishedSlugs.has(slug) ? href : fallback;
}
