"use client";
/** Shop filters — category chips, sort select, price range; pushes URL params (shareable, SSR-friendly). */
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  categories: { slug: string; name: string }[];
  current: { search?: string; category?: string; sort?: string; min?: string; max?: string };
}

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

export function ShopFilters({ categories, current }: Props) {
  const router = useRouter();
  const [min, setMin] = useState(current.min ?? "");
  const [max, setMax] = useState(current.max ?? "");

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...current, ...patch };
    if (merged.search) params.set("search", merged.search);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "relevance") params.set("sort", merged.sort);
    if (merged.min) params.set("min", merged.min);
    if (merged.max) params.set("max", merged.max);
    router.push(`/shop?${params.toString()}`);
  }

  const chips = [{ slug: "", name: "All" }, ...categories];

  return (
    <div className="card-soft flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category filter">
        {chips.map((c) => {
          const active = (current.category ?? "") === c.slug;
          return (
            <button
              key={c.slug || "all"}
              onClick={() => navigate({ category: c.slug || undefined, page: undefined })}
              aria-pressed={active}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-forest bg-forest text-cream" : "border-sand bg-white text-ink hover:border-honey"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-ink-soft" htmlFor="min-price">₹ min</label>
          <input
            id="min-price"
            className="input-base w-20 py-1.5 text-sm"
            type="number"
            min={0}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="0"
          />
          <label className="text-xs text-ink-soft" htmlFor="max-price">max</label>
          <input
            id="max-price"
            className="input-base w-20 py-1.5 text-sm"
            type="number"
            min={0}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="∞"
          />
          <button
            className="btn-outline px-3.5 py-1.5 text-sm"
            onClick={() => navigate({ min: min || undefined, max: max || undefined, page: undefined })}
          >
            Apply
          </button>
        </div>

        <label className="sr-only" htmlFor="sort">Sort products</label>
        <select
          id="sort"
          className="input-base w-44 py-1.5 text-sm"
          value={current.sort ?? "relevance"}
          onChange={(e) => navigate({ sort: e.target.value, page: undefined })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
