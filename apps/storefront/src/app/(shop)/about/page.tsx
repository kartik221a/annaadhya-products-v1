import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  IconArrowRight,
  IconAward,
  IconBadgeCheck,
  IconFlower2,
  IconGift,
  IconHeart,
  IconLeaf,
  IconPenLine,
  IconShoppingBag,
  IconSparkles,
  IconSunrise,
} from "@/components/icons";
import { getPage } from "@/lib/api";
import { CmsDocument } from "@/components/blocks/document-blocks";

const ABOUT_METADATA: Metadata = {
  title: "Our Story",
  description:
    "The story behind Annaadhya Products — a thoughtful Indian pantry of honey, Kashmiri kesar, dry fruits and festive hampers, curated for everyday rituals and meaningful gifting.",
  openGraph: {
    title: "Our Story | Annaadhya Products",
    description:
      "A thoughtful Indian pantry of honey, Kashmiri kesar, dry fruits and festive hampers — rooted in tradition, chosen with care.",
    type: "website",
    siteName: "Annaadhya Products",
  },
};

/** Approved "Our Story" (Stitch) imagery — all permanent /public/images assets. */
const COLLECTIONS = [
  {
    slug: "honey",
    href: "/category/honey",
    image: "/images/collection-honey.webp",
    alt: "Warm golden honey dripping from a carved wooden dipper into a glass jar on a sunlit table",
    badge: "Raw Harvest",
    badgeTone: "bg-surface-container-lowest/90 text-primary",
    title: "Wild & Floral Honey",
    copy: "Warm golden hues, natural textures, and quiet sweetness for daily morning rituals.",
    cta: "Discover Honey",
  },
  {
    slug: "kesar",
    href: "/category/kesar",
    image: "/images/collection-kesar.webp",
    alt: "Deep-red Kashmiri Mongra saffron threads in a hammered brass bowl with a vintage brass spoon",
    badge: "Kashmir Mongra",
    badgeTone: "bg-surface-container-lowest/90 text-primary",
    title: "Kashmiri Mongra Saffron",
    copy: "Deep crimson threads hand-culled for their delicate aroma and regal golden colour.",
    cta: "Discover Kesar",
  },
  {
    slug: "dry-fruits",
    href: "/category/dry-fruits",
    image: "/images/collection-dry-fruits.webp",
    alt: "Premium almonds, cashews and pistachios spilling from a rustic bowl onto woven linen",
    badge: "Sun-Dried",
    badgeTone: "bg-surface-container-lowest/90 text-primary",
    title: "Sun-Dried Nuts & Dry Fruits",
    copy: "Whole Mamra almonds, plump cashews, and rich pistachios for everyday nourishment.",
    cta: "Discover Dry Fruits",
  },
  {
    slug: "gift-boxes",
    href: "/category/gift-boxes",
    image: "/images/gifting-royal-hamper.webp",
    alt: "Royal heritage maroon keepsake hamper with gold embossing holding honey, saffron and dry fruits",
    badge: "Hand Assembled",
    badgeTone: "bg-primary text-on-primary",
    title: "Bespoke Festive Hampers",
    copy: "Thoughtfully composed assortments in keepsake velvet boxes, designed for heartfelt occasions.",
    cta: "Discover Hampers",
  },
] as const;

const PRINCIPLES = [
  {
    num: "01",
    icon: IconFlower2,
    title: "Thoughtful Selection",
    copy: "We value choosing pantry essentials with care and consideration, never compromising on character or provenance.",
  },
  {
    num: "02",
    icon: IconSunrise,
    title: "Everyday Rituals",
    copy: "We celebrate the small moments that make food part of how we live, pause, reconnect, and nourish our families.",
  },
  {
    num: "03",
    icon: IconSparkles,
    title: "The Joy of Sharing",
    copy: "We believe a thoughtfully chosen gift can bridge distances and make any celebration feel deeply personal.",
  },
  {
    num: "04",
    icon: IconAward,
    title: "Respect for Tradition",
    copy: "We draw inspiration from India's timeless culinary heritage while tailoring a considered, contemporary experience.",
  },
] as const;

const PILLARS = [
  {
    icon: IconLeaf,
    title: "A Considered Selection",
    copy: "Pantry essentials chosen for their craftsmanship, regional balance, natural character, and quiet culinary distinction.",
  },
  {
    icon: IconHeart,
    title: "A Welcoming Experience",
    copy: "Honest presentation, transparent details, and responsive care from our team — effortless exploration from our pantry to your table.",
  },
  {
    icon: IconGift,
    title: "Thoughtful Sharing & Gifting",
    copy: "Distinctive festive presentations, protective transit packaging, and personalized touches that turn gifts into cherished keepsakes.",
  },
] as const;

/** OUR STORY — the approved Stitch brand-story page for /about. Fully static editorial:
 *  no client JS, no data fetching beyond the shared (shop) shell. Copy follows the
 *  approved design with claims kept to the established editorial voice (see
 *  category-editorial.tsx): qualitative storytelling only, honesty stance preserved. */
/** Our Story page. The approved built-in design below is the default face of /about —
 *  the boot-seeded CMS mirror of this copy (badge/card-number-free, generic template)
 *  must never hijack the designed page. Only when an admin has explicitly saved and
 *  published their own content here (pages.service marks such docs `adminEdited`)
 *  does the page render through the reusable CMS document template instead. */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("our-story");
  if (page?.seo?.title || page?.seo?.description) {
    return {
      title: page.seo?.title || "Our Story",
      description: page.seo?.description,
    };
  }
  return ABOUT_METADATA;
}

export default async function AboutPage() {
  const page = await getPage("our-story");
  if (page?.adminEdited) return <CmsDocument page={page} />;
  return <BuiltInOurStory />;
}

function BuiltInOurStory() {
  return (
    <div className="flex w-full flex-col">
      {/* ---------------- Section 1 · Hero ---------------- */}
      <section className="relative w-full overflow-hidden bg-surface-bright">
        {/* Subtle atmospheric warmth */}
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-surface-container-high/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1320px] px-margin-mobile py-space-xl lg:px-margin lg:py-24">
          <div className="grid grid-cols-1 items-center gap-space-lg lg:grid-cols-12 lg:gap-space-xl">
            {/* Text column */}
            <div className="relative z-10 flex flex-col items-start lg:col-span-6">
              <div className="mb-space-md inline-flex items-center gap-space-xs rounded-full bg-surface-container px-3.5 py-1 text-label-sm uppercase tracking-[0.2em] text-on-tertiary-fixed-variant shadow-sm">
                <IconFlower2 size={16} className="text-on-tertiary-container" />
                <span>The Story of Annaadhya</span>
              </div>
              <h1 className="mb-space-md font-display text-display-lg-mobile leading-[1.15] tracking-tight text-primary lg:text-display-lg">
                Rooted in Tradition. <br className="hidden sm:inline" />
                <span className="font-normal italic text-primary-container">Chosen with Care.</span>
              </h1>
              <p className="mb-space-lg max-w-xl text-body-lg leading-relaxed text-on-surface-variant">
                Discover a thoughtful collection of pantry treasures inspired by India&rsquo;s rich
                food heritage, where everyday rituals, beautiful ingredients, and the joy of sharing
                come together.
              </p>
              <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                <Link
                  href="/shop"
                  className="btn-primary inline-flex items-center justify-center px-space-lg py-3 text-label-lg shadow-sm"
                >
                  Explore Our Pantry
                </Link>
                <div className="inline-flex items-center gap-2 text-label-md text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-on-tertiary-container" aria-hidden />
                  <span>Heirloom Recipes &amp; Rare Harvests</span>
                </div>
              </div>
            </div>

            {/* Visual column — framed print with caption plaque */}
            <div className="relative mt-space-lg lg:col-span-6 lg:mt-0">
              <div className="relative mx-auto max-w-[540px] overflow-hidden rounded-2xl bg-surface-container-low p-2.5 shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                  <Image
                    src="/images/hero-pantry-still-life.webp"
                    alt="Annaadhya pantry composition with raw wildflower honey, saffron and premium nuts on handmade paper"
                    fill
                    priority
                    sizes="(max-width: 1024px) 92vw, 40vw"
                    className="object-cover transition-transform duration-700 ease-out hover:scale-105"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent"
                    aria-hidden
                  />
                </div>
                {/* Editorial caption plaque */}
                <div className="mt-2 flex items-center justify-between rounded-md bg-surface-container-lowest/90 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <IconBadgeCheck size={20} className="text-on-tertiary-container" />
                    <span className="text-body-sm font-medium text-on-surface">
                      Inspired by Indian Heritage
                    </span>
                  </div>
                  <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
                    Harvest Reserve
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Section 2 · Our Philosophy ---------------- */}
      <section className="relative w-full bg-surface-container-low py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="grid grid-cols-1 items-center gap-space-xl lg:grid-cols-12">
            {/* Image plinth */}
            <div className="relative lg:col-span-6">
              <div className="relative overflow-hidden rounded-2xl bg-surface-container shadow-lg">
                <div className="aspect-[4/3] overflow-hidden">
                  <Image
                    src="/images/story-heritage-kitchen.webp"
                    alt="Sunlit Indian kitchen scene with a brass thali, earthenware and soft jali window light"
                    width={1200}
                    height={896}
                    sizes="(max-width: 1024px) 92vw, 42vw"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <div className="bg-surface-container-lowest p-space-md">
                  <p className="flex items-center gap-2 text-body-sm italic text-on-surface-variant">
                    <IconPenLine size={18} className="shrink-0 text-on-tertiary-container" />
                    Honoring quiet morning rituals and generational kitchen traditions.
                  </p>
                </div>
              </div>
            </div>

            {/* Narrative copy */}
            <div className="flex flex-col justify-center lg:col-span-6">
              <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.22em] text-on-tertiary-fixed-variant">
                Our Philosophy
              </span>
              <h2 className="mb-space-md font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                More Than What&rsquo;s in the Jar.
              </h2>
              <p className="mb-space-md text-body-lg leading-relaxed text-on-surface">
                We believe the things we bring into our homes deserve a little more thought. From the
                ingredients we keep close to the way we share a gift, every choice can make an
                ordinary moment feel more considered.
              </p>
              <p className="mb-space-lg text-body-md leading-relaxed text-on-surface-variant">
                In an era of rushed conveniences, Annaadhya pauses to venerate slow culinary
                practices&mdash;the gentle golden trickle of raw wild forest honey, the fragrant
                unspooling of Kashmiri Mongra saffron threads in warm milk, and the earthy richness
                of raw Mamra almonds.
              </p>
              <div className="grid grid-cols-2 gap-space-md pt-space-xs">
                <div className="rounded-md bg-surface-container-lowest p-space-md shadow-sm">
                  <div className="mb-1 font-display text-headline-sm font-semibold text-on-tertiary-container">
                    Verified
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    Every claim published with supplier documents behind it
                  </p>
                </div>
                <div className="rounded-md bg-surface-container-lowest p-space-md shadow-sm">
                  <div className="mb-1 font-display text-headline-sm font-semibold text-on-tertiary-container">
                    Ritual
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    Consciously chosen for daily moments
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Section 3 · Collection Essentials ---------------- */}
      <section className="w-full bg-surface-bright py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="mx-auto mb-space-xl max-w-2xl text-center">
            <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.25em] text-on-tertiary-fixed-variant">
              Collection Essentials
            </span>
            <h2 className="mb-space-sm font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
              A Pantry Inspired by India&rsquo;s Richness
            </h2>
            <p className="text-body-md leading-relaxed text-on-surface-variant">
              Culinary staples harvested with reverence, celebrating the textures, aromas, and
              stories of regions steeped in harvest wisdom.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-4">
            {COLLECTIONS.map((col) => (
              <div
                key={col.slug}
                className="group flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-surface-container">
                  <Image
                    src={col.image}
                    alt={col.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-label-sm font-semibold uppercase tracking-wider backdrop-blur-sm ${col.badgeTone}`}
                  >
                    {col.badge}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-space-lg">
                  <h3 className="mb-space-xs font-display text-headline-sm font-semibold text-primary transition-colors group-hover:text-primary-container">
                    {col.title}
                  </h3>
                  <p className="mb-space-md flex-1 text-body-sm leading-relaxed text-on-surface-variant">
                    {col.copy}
                  </p>
                  <Link
                    href={col.href}
                    className="inline-flex items-center gap-1 text-label-md font-semibold text-primary transition-all group-hover:gap-2"
                  >
                    <span>{col.cta}</span>
                    <IconArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Section 4 · What Guides Us ---------------- */}
      <section className="relative w-full bg-surface-container py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="mb-space-xl flex flex-col justify-between gap-space-md md:flex-row md:items-end">
            <div>
              <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.25em] text-on-tertiary-fixed-variant">
                Core Values
              </span>
              <h2 className="font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                What Guides Us
              </h2>
            </div>
            <p className="max-w-md text-body-md text-on-surface-variant">
              Every product in our pantry stands upon principles that prioritize integrity, mindful
              savoring, and honest relationships.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div
                key={p.num}
                className="flex h-full flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm"
              >
                <div>
                  <div className="mb-space-md flex items-center justify-between">
                    <span className="font-display text-[32px] italic text-on-tertiary-container">
                      {p.num}
                    </span>
                    <p.icon size={24} className="text-secondary" />
                  </div>
                  <h3 className="mb-space-xs font-display text-headline-sm font-semibold text-primary">
                    {p.title}
                  </h3>
                  <p className="text-body-md leading-relaxed text-on-surface-variant">{p.copy}</p>
                </div>
                <div className="mt-space-lg h-0.5 w-8 rounded-full bg-tertiary-fixed" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Section 5 · The Art of Giving ---------------- */}
      <section className="relative w-full overflow-hidden bg-surface-bright py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="rounded-3xl bg-surface-container-lowest p-space-lg shadow-lg lg:p-space-xl">
            <div className="grid grid-cols-1 items-center gap-space-xl lg:grid-cols-12">
              {/* Text narrative */}
              <div className="order-2 flex flex-col items-start lg:order-1 lg:col-span-6">
                <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.25em] text-on-tertiary-fixed-variant">
                  The Art of Giving
                </span>
                <h2 className="mb-space-md font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                  Some Things Are Better Shared.
                </h2>
                <p className="mb-space-md text-body-lg leading-relaxed text-on-surface">
                  A thoughtfully chosen gift can turn a simple gesture into a lasting memory. Our
                  world of pantry treasures and gift hampers is inspired by the pleasure of giving
                  something warm, meaningful, and made to be enjoyed.
                </p>
                <p className="mb-space-lg text-body-md leading-relaxed text-on-surface-variant">
                  Each hamper is hand-assembled in keepsake velvet boxes with gold embossing, pairing
                  golden wild honeys with Mamra almonds and Kashmiri saffron.
                </p>
                <Link
                  href="/category/gift-boxes"
                  className="inline-flex items-center gap-space-xs rounded-md bg-primary px-space-lg py-3 text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                >
                  <span>Explore Gift Hampers</span>
                  <IconGift size={18} />
                </Link>
              </div>
              {/* Hamper showcase */}
              <div className="order-1 lg:order-2 lg:col-span-6">
                <div className="relative overflow-hidden rounded-2xl bg-surface-container-high/40 shadow-md">
                  <div className="aspect-[4/3] overflow-hidden">
                    <Image
                      src="/images/gifting-royal-hamper.webp"
                      alt="Handcrafted royal maroon keepsake box with honey jars, a saffron tin and assorted premium nuts"
                      fill
                      sizes="(max-width: 1024px) 92vw, 42vw"
                      className="object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Section 6 · Our Promise ---------------- */}
      <section className="w-full bg-surface-container-low py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="mx-auto mb-space-xl max-w-2xl text-center">
            <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.25em] text-on-tertiary-fixed-variant">
              Our Commitment
            </span>
            <h2 className="mb-space-sm font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
              A More Thoughtful Way to Shop.
            </h2>
            <p className="text-body-md leading-relaxed text-on-surface-variant">
              From discovering something special to placing an order, we want your experience with
              Annaadhya Products to feel clear, considered, and welcoming.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="flex flex-col items-center rounded-2xl bg-surface-container-lowest p-space-lg text-center shadow-sm"
              >
                <div className="mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm">
                  <pillar.icon size={28} />
                </div>
                <h3 className="mb-space-xs font-display text-headline-sm font-semibold text-primary">
                  {pillar.title}
                </h3>
                <p className="text-body-sm leading-relaxed text-on-surface-variant">{pillar.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Section 7 · Closing CTA ---------------- */}
      <section className="relative w-full overflow-hidden bg-primary py-space-xl text-on-primary lg:py-24">
        {/* Ambient gold sheen */}
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-on-tertiary-container/10 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-[1320px] px-margin-mobile text-center lg:px-margin">
          <div className="mb-space-md inline-flex items-center gap-space-xs rounded-full bg-primary-container px-3.5 py-1 text-label-sm uppercase tracking-widest text-on-tertiary-container shadow-sm">
            <IconShoppingBag size={16} />
            <span>Artisanal Pantry</span>
          </div>
          <h2 className="mx-auto mb-space-sm max-w-2xl font-display text-headline-lg-mobile tracking-tight text-on-primary lg:text-headline-lg">
            Bring Something Thoughtful Home.
          </h2>
          <p className="mx-auto mb-space-xl max-w-xl text-body-lg leading-relaxed text-on-primary-container">
            Explore pantry favourites and gifts chosen for the moments worth savouring.
          </p>
          <div className="flex flex-col items-center justify-center gap-space-md sm:flex-row">
            <Link
              href="/shop"
              className="inline-flex w-full items-center justify-center rounded-md bg-surface-container-lowest px-space-xl py-3 text-label-lg font-bold text-primary shadow-md transition-colors hover:bg-surface-container sm:w-auto"
            >
              Explore Our Collection
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center rounded-md bg-transparent px-space-xl py-3 text-label-lg font-semibold text-on-primary transition-colors hover:bg-primary-container sm:w-auto"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
