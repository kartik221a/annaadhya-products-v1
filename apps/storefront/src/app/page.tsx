import Link from "next/link";
import { getBestsellers, getCategories, getFeatured } from "@/lib/api";
import { ProductGrid, ProductCardSkeleton } from "@/components/product-card";

export const revalidate = 60;

const TRUST = [
  { icon: "🍯", title: "Verified before published", copy: "Variety, origin and grade claims appear only with supplier documentation." },
  { icon: "🚚", title: "Careful, quick dispatch", copy: "Small batches, packed with care and dispatched promptly across India." },
  { icon: "🤝", title: "Fair, honest pricing", copy: "Premium quality at reasonable prices — no inflated MRPs, no invented claims." },
  { icon: "💬", title: "Real human support", copy: "Questions about a batch, an order or a gift? Talk to us before and after you buy." },
];

export default async function HomePage() {
  const [categories, bestsellers, featured] = await Promise.all([getCategories(), getBestsellers(), getFeatured()]);
  const ready = categories.filter((c) => c.isReady);
  const giftComing = categories.find((c) => !c.isReady);
  const apiOffline = categories.length === 0 && bestsellers.length === 0 && featured.length === 0;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-sand bg-gradient-to-b from-cream-deep to-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-honey-deep">
              Honey · Dry fruits · Kesar
            </p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.12] text-forest md:text-5xl">
              Pantry treasures,
              <br />
              honestly sourced
            </h1>
            <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-ink-soft">
              Premium-quality honey, dry fruits and saffron at reasonable prices — curated for Indian
              kitchens, festive tables and thoughtful gifting.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary px-7 py-3 text-sm">
                Shop the collection
              </Link>
              <Link href="/about" className="btn-outline px-7 py-3 text-sm">
                Our story
              </Link>
            </div>
            <p className="mt-6 text-xs text-ink-soft">
              Demo catalogue — product claims and prices are placeholders pending supplier verification.
            </p>
          </div>

          <div className="relative">
            <div className="card-soft overflow-hidden">
              <img
                src="/demo-images/hero.svg"
                alt="Annaadhya honey, dry fruits and saffron arrangement"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-display absolute -left-3 -top-3 rotate-[-6deg] rounded-full bg-honey px-4 py-1.5 text-sm font-semibold text-ink shadow-sm">
              Small batches
            </span>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="categories-heading">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="categories-heading" className="font-display text-2xl font-semibold text-ink md:text-3xl">
              Shop by category
            </h2>
            <p className="mt-2 text-sm text-ink-soft">Everyday staples and festive treasures, chosen with care.</p>
          </div>
          <Link href="/shop" className="hidden text-sm font-semibold text-forest hover:underline sm:block">
            View all →
          </Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {ready.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="card-soft group flex flex-col p-6 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden>
                {c.slug === "honey" ? "🍯" : c.slug === "dry-fruits" ? "🥜" : "🌾"}
              </span>
              <h3 className="font-display mt-3 text-xl font-semibold text-forest">{c.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{c.tagline}</p>
              <span className="mt-4 text-sm font-semibold text-forest underline-offset-2 group-hover:underline">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="motif-divider mx-auto max-w-6xl" aria-hidden />

      {/* Bestsellers */}
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="best-heading">
        <h2 id="best-heading" className="font-display text-2xl font-semibold text-ink md:text-3xl">
          Bestsellers
        </h2>
        <p className="mt-2 text-sm text-ink-soft">What Indian pantries are reaching for.</p>
        <div className="mt-7">
          {bestsellers.length ? (
            <ProductGrid products={bestsellers} />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="border-y border-sand bg-cream-deep/60 py-14" aria-labelledby="featured-heading">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="featured-heading" className="font-display text-2xl font-semibold text-ink md:text-3xl">
              Featured this season
            </h2>
            <div className="mt-7">
              <ProductGrid products={featured} />
            </div>
          </div>
        </section>
      )}

      {/* Brand story */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-honey-deep">Why Annaadhya</p>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-snug text-forest">
              Traditional warmth, modern standards
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              We started Annaadhya with a simple belief: Indian families deserve pantry staples they can
              trust without paying inflated prices. We work directly with suppliers, keep batches small
              and fresh, and publish product claims only when supplier documents back them.
            </p>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Where a claim cannot yet be verified — an origin, a grade, a floral source — we say so
              plainly on the product page. Trust is built slowly; we intend to keep it.
            </p>
            <Link href="/about" className="btn-outline mt-6 inline-block px-6 py-2.5 text-sm">
              Read our story
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TRUST.map((t) => (
              <div key={t.title} className="card-soft p-5">
                <span className="text-xl" aria-hidden>{t.icon}</span>
                <h3 className="mt-2 font-semibold text-ink">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gift collection teaser */}
      {giftComing && (
        <section className="border-y border-sand bg-forest text-cream">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold md:text-3xl">{giftComing.name} — coming soon</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/85">{giftComing.description}</p>
            </div>
            <Link href="/contact" className="btn-primary bg-honey px-6 py-3 text-sm !text-ink hover:!bg-honey-deep">
              Enquire about gifting
            </Link>
          </div>
        </section>
      )}

      {apiOffline && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="card-soft border-honey/50 p-6">
            <h2 className="font-semibold text-ink">Store is warming up</h2>
            <p className="mt-2 text-sm text-ink-soft">
              The catalogue API isn&apos;t reachable right now, so shelves look empty. Start it with
              <code className="mx-1 rounded bg-cream-deep px-1.5 py-0.5">pnpm dev:api</code>
              and refresh.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
