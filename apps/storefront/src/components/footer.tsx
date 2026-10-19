import Link from "next/link";

export function Footer({ categories }: { categories: { slug: string; name: string }[] }) {
  return (
    <footer className="mt-auto border-t border-sand bg-cream-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-forest">Annaadhya Products</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            Premium-quality honey, dry fruits and kesar at reasonable prices — packed for Indian homes,
            with every claim verified before we publish it.
          </p>
          <div className="motif-divider mt-5 w-28" aria-hidden />
        </div>

        <nav aria-label="Shop">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-forest" href="/shop">All products</Link></li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link className="hover:text-forest" href={`/category/${c.slug}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-forest" href="/about">About Annaadhya</Link></li>
            <li><Link className="hover:text-forest" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-forest" href="/faq">FAQ</Link></li>
          </ul>
        </nav>

        <nav aria-label="Policies">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">Policies</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-forest" href="/policies/shipping">Shipping &amp; delivery</Link></li>
            <li><Link className="hover:text-forest" href="/policies/returns">Returns &amp; refunds</Link></li>
            <li><Link className="hover:text-forest" href="/policies/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-forest" href="/policies/terms">Terms &amp; conditions</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-sand">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-ink-soft sm:flex-row">
          <p>© {new Date().getFullYear()} Annaadhya Products. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span aria-hidden>🔒</span> Payments stay in sandbox mode until launch approval.
          </p>
        </div>
      </div>
    </footer>
  );
}
