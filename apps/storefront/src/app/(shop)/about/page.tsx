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
import { getPage, getCategoryOverview } from "@/lib/api";
import { CmsBlocks, renderInline } from "@/components/blocks/document-blocks";
import { mapCmsPageToSlots, isCustomizedTitle, type MappedCmsPage } from "@/lib/cms-page-slots";

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

/** ---------------------------------------------------------------------------
 *  OUR STORY (/about) — the approved Stitch brand-story page.
 *
 *  EDITING MODEL (the "ugly takeover" bug, fixed for good): the admin's
 *  published page content flows INTO this approved design slot by slot, keyed
 *  by each section's stable anchor id — hero copy, philosophy, the collections
 *  header, the values cards, the giving panel, the promise cards and the
 *  closing banner each consume their own section. Nothing renders twice and
 *  the page can never degrade into the generic document template:
 *    - a slot part the admin left empty falls back to the approved copy, so a
 *      half-edited page still looks finished;
 *    - brand-new sections (unknown anchor ids) render once, as a story band
 *      between the hero and the philosophy chapter, in the same design
 *      language;
 *    - the collection cards follow the LIVE catalogue (deletion doctrine) —
 *      admin cards in the "collections" section are intentionally not rendered.
 *  ------------------------------------------------------------------------ */

/** Stable anchor ids of the shipped Our Story document (packages/data-core). */
const STORY_SECTION_IDS = [
  "story",
  "philosophy",
  "collections",
  "what-guides-us",
  "art-of-giving",
  "our-promise",
  "bring-it-home",
] as const;

const SEED_HEADLINE = "Rooted in Tradition. Chosen with Care.";
const DEFAULT_LEDE =
  "Discover a thoughtful collection of pantry treasures inspired by India\u2019s rich food heritage, where everyday rituals, beautiful ingredients, and the joy of sharing come together.";

/** Designed fallback copy for each managed slot (mirrors the boot-seed doc). */
const PHILOSOPHY_DEFAULTS = {
  eyebrow: "Our Philosophy",
  title: "More Than What\u2019s in the Jar.",
  paragraphs: [
    "We believe the things we bring into our homes deserve a little more thought. From the ingredients we keep close to the way we share a gift, every choice can make an ordinary moment feel more considered.",
    "In an era of rushed conveniences, Annaadhya pauses to venerate slow culinary practices\u2014the gentle golden trickle of raw wild forest honey, the fragrant unspooling of Kashmiri Mongra saffron threads in warm milk, and the earthy richness of raw Mamra almonds.",
  ],
  image: {
    src: "/images/story-heritage-kitchen.webp",
    alt: "Sunlit Indian kitchen scene with a brass thali, earthenware and soft jali window light",
    caption: "Honoring quiet morning rituals and generational kitchen traditions.",
  },
  cards: [
    { title: "Verified", text: "Every claim published with supplier documents behind it" },
    { title: "Ritual", text: "Consciously chosen for daily moments" },
  ],
} as const;

const COLLECTIONS_DEFAULTS = {
  eyebrow: "Collection Essentials",
  title: "A Pantry Inspired by India\u2019s Richness",
  paragraph:
    "Culinary staples harvested with reverence, celebrating the textures, aromas, and stories of regions steeped in harvest wisdom.",
} as const;

const GUIDES_DEFAULTS = {
  eyebrow: "Core Values",
  title: "What Guides Us",
  paragraph:
    "Every product in our pantry stands upon principles that prioritize integrity, mindful savoring, and honest relationships.",
} as const;

const GIVING_DEFAULTS = {
  eyebrow: "The Art of Giving",
  title: "Some Things Are Better Shared.",
  paragraphs: [
    "A thoughtfully chosen gift can turn a simple gesture into a lasting memory. Our world of pantry treasures and gift hampers is inspired by the pleasure of giving something warm, meaningful, and made to be enjoyed.",
    "Each hamper is hand-assembled in keepsake velvet boxes with gold embossing, pairing golden wild honeys with Mamra almonds and Kashmiri saffron.",
  ],
  image: {
    src: "/images/gifting-royal-hamper.webp",
    alt: "Handcrafted royal maroon keepsake box with honey jars, a saffron tin and assorted premium nuts",
  },
  cta: { label: "Explore Gift Hampers", href: "/category/gift-boxes" },
} as const;

const PROMISE_DEFAULTS = {
  eyebrow: "Our Commitment",
  title: "A More Thoughtful Way to Shop.",
  paragraph:
    "From discovering something special to placing an order, we want your experience with Annaadhya Products to feel clear, considered, and welcoming.",
} as const;

const CTA_DEFAULTS = {
  banner: {
    title: "Bring Something Thoughtful Home.",
    text: "Explore pantry favourites and gifts chosen for the moments worth savouring.",
  },
  ctas: [
    { label: "Explore Our Collection", href: "/shop" },
    { label: "Get in Touch", href: "/contact" },
  ],
} as const;

/** Cycled decorative icons for admin-provided value/principle cards. */
const PRINCIPLE_ICONS = [IconFlower2, IconSunrise, IconSparkles, IconAward, IconLeaf, IconHeart, IconGift, IconShoppingBag];
const PILLAR_ICONS = [IconLeaf, IconHeart, IconGift];

/** Internal-link guard mirroring the block renderer's rules. */
function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}


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

/** The admin-owned slots the design exposes, mapped by stable section id. */
export default async function AboutPage() {
  const [page, overview] = await Promise.all([getPage("our-story"), getCategoryOverview()]);
  // Deletion doctrine: the live catalogue decides which collection cards and
  // category CTAs exist here. An unreachable catalogue (deploy-time build race)
  // drops them too — an owner's deletion is never re-rendered by an outage.
  const liveSlugs: Set<string> | null = overview
    ? new Set(overview.categories.map((c) => c.slug))
    : null;
  const isLive = (slug: string) => liveSlugs !== null && liveSlugs.has(slug);
  const cms = mapCmsPageToSlots(page, STORY_SECTION_IDS);
  // Hero headline: the admin's customized page title wins; otherwise the story
  // section's title when they changed it; otherwise the approved two-tone mark.
  const storyTitle = cms?.byId.story?.title ?? "";
  const heroTitle =
    isCustomizedTitle(cms, "Our Story") ??
    (storyTitle && storyTitle.toLowerCase() !== SEED_HEADLINE.toLowerCase() ? storyTitle : null);
  return (
    <BuiltInOurStory
      cms={cms}
      heroTitle={heroTitle}
      showCollections={(slug: string) => isLive(slug)}
    />
  );
}

function BuiltInOurStory({
  cms,
  heroTitle,
  showCollections,
}: {
  cms: MappedCmsPage | null;
  /** Resolved hero headline — null renders the approved two-tone headline. */
  heroTitle: string | null;
  /** Live-catalogue predicate — a deleted/archived category's collection card
   *  and category CTA never render, even when the catalogue is unreachable. */
  showCollections: (slug: string) => boolean;
}) {
  const hero = cms?.byId.story;
  const heroLede = cms?.lede || DEFAULT_LEDE;
  const heroImage = hero?.image;
  const heroCta = hero?.ctas[0];
  const heroNote = heroCta?.note ?? "Heirloom Recipes & Rare Harvests";
  const philosophy = cms?.byId.philosophy;
  const philosophyParagraphs =
    philosophy?.paragraphs && philosophy.paragraphs.length > 0
      ? philosophy.paragraphs
      : [...PHILOSOPHY_DEFAULTS.paragraphs];
  const philosophyImage = philosophy?.image ?? PHILOSOPHY_DEFAULTS.image;
  const philosophyCards =
    philosophy?.cards && philosophy.cards.length > 0 ? philosophy.cards : [...PHILOSOPHY_DEFAULTS.cards];
  const collections = cms?.byId.collections;
  const guides = cms?.byId["what-guides-us"];
  const guidesCards =
    guides?.cards && guides.cards.length > 0
      ? guides.cards
      : PRINCIPLES.map((p) => ({ title: p.title, text: p.copy }));
  const giving = cms?.byId["art-of-giving"];
  const givingParagraphs =
    giving?.paragraphs && giving.paragraphs.length > 0 ? giving.paragraphs : [...GIVING_DEFAULTS.paragraphs];
  const givingImage = giving?.image ?? GIVING_DEFAULTS.image;
  const givingCta = giving?.ctas[0] ?? GIVING_DEFAULTS.cta;
  const givingCtaLive = !givingCta.href.startsWith("/category/") || showCollections(givingCta.href.split("/")[2] ?? "");
  const promise = cms?.byId["our-promise"];
  const promiseCards =
    promise?.cards && promise.cards.length > 0
      ? promise.cards
      : PILLARS.map((p) => ({ title: p.title, text: p.copy }));
  const closing = cms?.byId["bring-it-home"];
  const closingBanner = closing?.banner ?? CTA_DEFAULTS.banner;
  const closingCtas =
    closing?.ctas && closing.ctas.length > 0 ? closing.ctas.slice(0, 2) : [...CTA_DEFAULTS.ctas];
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
                <span>{hero?.eyebrow ?? "The Story of Annaadhya"}</span>
              </div>
              <h1 className="mb-space-md font-display text-display-lg-mobile leading-[1.15] tracking-tight text-primary lg:text-display-lg">
                {heroTitle ? (
                  heroTitle
                ) : (
                  <>
                    Rooted in Tradition. <br className="hidden sm:inline" />
                    <span className="font-normal italic text-primary-container">Chosen with Care.</span>
                  </>
                )}
              </h1>
              <p className="mb-space-lg max-w-xl text-body-lg leading-relaxed text-on-surface-variant">{heroLede}</p>
              <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                <Link
                  href={heroCta && isInternalHref(heroCta.href) ? heroCta.href : "/shop"}
                  className="btn-primary inline-flex items-center justify-center px-space-lg py-3 text-label-lg shadow-sm"
                >
                  {heroCta?.label ?? "Explore Our Pantry"}
                </Link>
                <div className="inline-flex items-center gap-2 text-label-md text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-on-tertiary-container" aria-hidden />
                  <span>{heroNote}</span>
                </div>
              </div>
            </div>

            {/* Visual column — framed print with caption plaque */}
            <div className="relative mt-space-lg lg:col-span-6 lg:mt-0">
              <div className="relative mx-auto max-w-[540px] overflow-hidden rounded-2xl bg-surface-container-low p-2.5 shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                  <Image
                    src={heroImage?.src ?? "/images/hero-pantry-still-life.webp"}
                    alt={heroImage?.alt || "Annaadhya pantry composition with raw wildflower honey, saffron and premium nuts on handmade paper"}
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
                      {heroImage?.caption ?? "Inspired by Indian Heritage"}
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

      {/* ---------------- Extra story band ---------------- */}
      {/* Only brand-new sections (unknown anchor ids) render here — every
          managed slot above/below consumes its own section instead, so admin
          edits flow into the approved design and nothing appears twice. */}
      {cms && cms.extras.length > 0 && (
        <section className="w-full bg-surface-container-lowest py-space-xl lg:py-24" aria-label="More of our story">
          <div className="mx-auto max-w-3xl px-margin-mobile lg:px-margin">
            <div className="space-y-space-xl">
              {cms.extras.map(({ section }, i) => (
                <div key={section.id ?? i} id={section.id ?? `story-${i + 1}`} className="scroll-mt-32 space-y-space-md">
                  {section.eyebrow ? (
                    <span className="block text-label-md font-bold uppercase tracking-[0.22em] text-on-tertiary-fixed-variant">
                      {String(i + 1).padStart(2, "0")}
                      {" • "}
                      {section.eyebrow}
                    </span>
                  ) : null}
                  {section.title ? (
                    <h2 className="font-display text-headline-md tracking-tight text-primary">{section.title}</h2>
                  ) : null}
                  <CmsBlocks blocks={section.blocks ?? []} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Section 2 · Our Philosophy ---------------- */}
      <section className="relative w-full bg-surface-container-low py-space-xl lg:py-28">
        <div className="mx-auto max-w-[1320px] px-margin-mobile lg:px-margin">
          <div className="grid grid-cols-1 items-center gap-space-xl lg:grid-cols-12">
            {/* Image plinth */}
            <div className="relative lg:col-span-6">
              <div className="relative overflow-hidden rounded-2xl bg-surface-container shadow-lg">
                <div className="aspect-[4/3] overflow-hidden">
                  <Image
                    src={philosophyImage.src}
                    alt={philosophyImage.alt}
                    width={1200}
                    height={896}
                    sizes="(max-width: 1024px) 92vw, 42vw"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <div className="bg-surface-container-lowest p-space-md">
                  <p className="flex items-center gap-2 text-body-sm italic text-on-surface-variant">
                    <IconPenLine size={18} className="shrink-0 text-on-tertiary-container" />
                    {philosophyImage.caption}
                  </p>
                </div>
              </div>
            </div>

            {/* Narrative copy */}
            <div className="flex flex-col justify-center lg:col-span-6">
              <span className="mb-space-xs block text-label-md font-bold uppercase tracking-[0.22em] text-on-tertiary-fixed-variant">
                {philosophy?.eyebrow ?? PHILOSOPHY_DEFAULTS.eyebrow}
              </span>
              <h2 className="mb-space-md font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                {philosophy?.title ?? PHILOSOPHY_DEFAULTS.title}
              </h2>
              {philosophyParagraphs.map((text, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "mb-space-md text-body-lg leading-relaxed text-on-surface"
                      : "mb-space-md text-body-md leading-relaxed text-on-surface-variant"
                  }
                >
                  {renderInline(text)}
                </p>
              ))}
              <div className="grid grid-cols-2 gap-space-md pt-space-xs">
                {philosophyCards.slice(0, 4).map((card, i) => (
                  <div key={i} className="rounded-md bg-surface-container-lowest p-space-md shadow-sm">
                    <div className="mb-1 font-display text-headline-sm font-semibold text-on-tertiary-container">
                      {card.title}
                    </div>
                    <p className="text-body-sm text-on-surface-variant">{card.text}</p>
                  </div>
                ))}
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
              {collections?.eyebrow ?? COLLECTIONS_DEFAULTS.eyebrow}
            </span>
            <h2 className="mb-space-sm font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
              {collections?.title ?? COLLECTIONS_DEFAULTS.title}
            </h2>
            <p className="text-body-md leading-relaxed text-on-surface-variant">
              {collections?.paragraphs[0] ?? COLLECTIONS_DEFAULTS.paragraph}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-4">
            {COLLECTIONS.filter((col) => showCollections(col.slug)).map((col) => (
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
                {guides?.eyebrow ?? GUIDES_DEFAULTS.eyebrow}
              </span>
              <h2 className="font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                {guides?.title ?? GUIDES_DEFAULTS.title}
              </h2>
            </div>
            <p className="max-w-md text-body-md text-on-surface-variant">
              {guides?.paragraphs[0] ?? GUIDES_DEFAULTS.paragraph}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
            {guidesCards.map((card, i) => {
              const Icon = PRINCIPLE_ICONS[i % PRINCIPLE_ICONS.length];
              return (
                <div
                  key={i}
                  className="flex h-full flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm"
                >
                  <div>
                    <div className="mb-space-md flex items-center justify-between">
                      <span className="font-display text-[32px] italic text-on-tertiary-container">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Icon size={24} className="text-secondary" />
                    </div>
                    <h3 className="mb-space-xs font-display text-headline-sm font-semibold text-primary">
                      {card.title}
                    </h3>
                    <p className="text-body-md leading-relaxed text-on-surface-variant">{card.text}</p>
                  </div>
                  <div className="mt-space-lg h-0.5 w-8 rounded-full bg-tertiary-fixed" aria-hidden />
                </div>
              );
            })}
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
                  {giving?.eyebrow ?? GIVING_DEFAULTS.eyebrow}
                </span>
                <h2 className="mb-space-md font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
                  {giving?.title ?? GIVING_DEFAULTS.title}
                </h2>
                {givingParagraphs.map((text, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? "mb-space-md text-body-lg leading-relaxed text-on-surface"
                        : "mb-space-md text-body-md leading-relaxed text-on-surface-variant"
                    }
                  >
                    {renderInline(text)}
                  </p>
                ))}
                {givingCtaLive ? (
                  <Link
                    href={isInternalHref(givingCta.href) ? givingCta.href : "/shop"}
                    className="inline-flex items-center gap-space-xs rounded-md bg-primary px-space-lg py-3 text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                  >
                    <span>{givingCta.label}</span>
                    <IconGift size={18} />
                  </Link>
                ) : null}
              </div>
              {/* Hamper showcase */}
              <div className="order-1 lg:order-2 lg:col-span-6">
                <div className="relative overflow-hidden rounded-2xl bg-surface-container-high/40 shadow-md">
                  <div className="aspect-[4/3] overflow-hidden">
                    <Image
                      src={givingImage.src}
                      alt={givingImage.alt}
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
              {promise?.eyebrow ?? PROMISE_DEFAULTS.eyebrow}
            </span>
            <h2 className="mb-space-sm font-display text-headline-lg-mobile tracking-tight text-primary lg:text-headline-lg">
              {promise?.title ?? PROMISE_DEFAULTS.title}
            </h2>
            <p className="text-body-md leading-relaxed text-on-surface-variant">
              {promise?.paragraphs[0] ?? PROMISE_DEFAULTS.paragraph}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-space-lg md:grid-cols-3">
            {promiseCards.map((card, i) => {
              const Icon = PILLAR_ICONS[i % PILLAR_ICONS.length];
              return (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-2xl bg-surface-container-lowest p-space-lg text-center shadow-sm"
                >
                  <div className="mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm">
                    <Icon size={28} />
                  </div>
                  <h3 className="mb-space-xs font-display text-headline-sm font-semibold text-primary">
                    {card.title}
                  </h3>
                  <p className="text-body-sm leading-relaxed text-on-surface-variant">{card.text}</p>
                </div>
              );
            })}
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
            {closingBanner.title || CTA_DEFAULTS.banner.title}
          </h2>
          <p className="mx-auto mb-space-xl max-w-xl text-body-lg leading-relaxed text-on-primary-container">
            {closingBanner.text || CTA_DEFAULTS.banner.text}
          </p>
          <div className="flex flex-col items-center justify-center gap-space-md sm:flex-row">
            {closingCtas.map((cta, i) => (
              <Link
                key={i}
                href={isInternalHref(cta.href) ? cta.href : "/shop"}
                className={
                  i === 0
                    ? "inline-flex w-full items-center justify-center rounded-md bg-surface-container-lowest px-space-xl py-3 text-label-lg font-bold text-primary shadow-md transition-colors hover:bg-surface-container sm:w-auto"
                    : "inline-flex w-full items-center justify-center rounded-md bg-transparent px-space-xl py-3 text-label-lg font-semibold text-on-primary transition-colors hover:bg-primary-container sm:w-auto"
                }
              >
                {cta.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
