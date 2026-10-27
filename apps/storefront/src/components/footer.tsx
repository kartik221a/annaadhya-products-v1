import Link from "next/link";
import { Logo } from "./logo";
import { IconLeaf } from "./icons";
import { NewsletterForm } from "./newsletter-form";

/** Approved editorial footer — warm ivory canvas, gold hairline, four columns.
 *  Rendered once from the root layout; pages must not add their own footer.
 *  Customer-care and legal links come from the admin Navigation manager when it
 *  has saved items for those locations; the curated defaults below are the
 *  fallback (API offline / empty CMS configuration).
 *  Category links always follow the live catalogue: the static Gift Hampers
 *  entry renders ONLY when the catalogue itself is unreachable (`catalogueUnavailable`)
 *  — when the API answered, its list is the truth and an archived category is
 *  never resurrected here. */
export function Footer({
  categories,
  careLinks,
  legalLinks,
  catalogueUnavailable = false,
}: {
  categories: { slug: string; name: string }[];
  careLinks?: { href: string; label: string }[];
  legalLinks?: { href: string; label: string }[];
  /** True only when the catalogue API could not be read — the one case where
   *  the static curated category entries are safer than an empty column. */
  catalogueUnavailable?: boolean;
}) {
  const year = new Date().getFullYear();
  const CARE =
    careLinks && careLinks.length > 0
      ? careLinks
      : [
          { href: "/faq", label: "Frequently Asked Questions" },
          { href: "/policies/shipping", label: "Shipping & Delivery" },
          { href: "/policies/returns", label: "Returns & Replacements" },
          { href: "/account", label: "Track Your Order" },
          { href: "/contact", label: "Contact Us" },
        ];
  const LEGAL =
    legalLinks && legalLinks.length > 0
      ? legalLinks
      : [
          { href: "/policies/privacy", label: "Privacy Policy" },
          { href: "/policies/terms", label: "Terms & Conditions" },
          { href: "/policies/shipping", label: "Shipping & Returns" },
        ];
  return (
    <footer className="w-full border-t border-gold-deep/30 bg-ivory text-umber">
      <div className="mx-auto max-w-7xl px-margin-mobile pb-space-lg pt-space-xl lg:px-margin">
        <div className="grid grid-cols-1 gap-space-xl pb-space-xl md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="space-y-space-md">
            <Logo height={38} dark />
            <p className="text-body-sm leading-relaxed text-umber-soft">
              Artisanal pantry essentials inspired by the richness of Indian food traditions.
            </p>
            <div className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-3.5 py-1.5 text-label-sm text-primary shadow-sm">
              <IconLeaf size={16} className="text-on-tertiary-container" />
              <span>Inspired by Indian Heritage</span>
            </div>
          </div>

          {/* Explore */}
          <nav aria-label="Explore">
            <h4 className="font-display mb-space-md text-[1.25rem] font-semibold text-umber">Explore</h4>
            <ul className="space-y-space-sm text-body-sm text-umber-soft">
              <li><Link className="transition-colors hover:text-primary" href="/shop">Shop All</Link></li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link className="transition-colors hover:text-primary" href={`/category/${c.slug}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
              {/* Offline-only fallback: when the catalogue answered, its list is the
                  truth — an archived category must never be resurrected here. */}
              {catalogueUnavailable && !categories.some((c) => c.slug === "gift-boxes") ? (
                <li><Link className="transition-colors hover:text-primary" href="/category/gift-boxes">Gift Hampers</Link></li>
              ) : null}
            </ul>
          </nav>

          {/* Customer care */}
          <nav aria-label="Customer care">
            <h4 className="font-display mb-space-md text-[1.25rem] font-semibold text-umber">Customer Care</h4>
            <ul className="space-y-space-sm text-body-sm text-umber-soft">
              {CARE.map((l) => (
                <li key={l.href}>
                  <Link className="transition-colors hover:text-primary" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Newsletter + payments */}
          <div className="space-y-space-md">
            <h4 className="font-display text-[1.25rem] font-semibold leading-snug text-umber">
              A Little Goodness in Your Inbox
            </h4>
            <p className="text-body-sm leading-relaxed text-umber-soft">
              Seasonal harvest announcements, curated gift collections, and notes from our pantry.
            </p>
            <NewsletterForm variant="footer" />
            <div className="pt-space-xs">
              <span className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-outline">
                Accepted Payment Modes
              </span>
              <div className="flex flex-wrap items-center gap-space-xs">
                {["UPI", "RuPay", "Visa", "Mastercard", "NetBanking"].map((mode) => (
                  <span
                    key={mode}
                    className="rounded-sm bg-surface-container-high px-2 py-1 text-[0.625rem] font-bold text-on-surface"
                  >
                    {mode}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[0.625rem] text-umber-soft">
                Payments run in sandbox mode until launch approval.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-space-sm border-t border-gold-deep/20 pt-space-md text-label-sm text-umber-soft sm:flex-row">
          <p>© {year} Annaadhya Products. All rights reserved.</p>
          <div className="flex items-center gap-space-md">
            {LEGAL.map((l, i) => (
              <span key={l.href} className="flex items-center gap-space-md">
                {i > 0 ? <span aria-hidden>•</span> : null}
                <Link className="transition-colors hover:text-primary" href={l.href}>
                  {l.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
