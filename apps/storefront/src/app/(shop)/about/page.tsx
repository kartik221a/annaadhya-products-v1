import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Annaadhya",
  description: "The story behind Annaadhya Products — honest sourcing, small batches and fair prices.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-honey-deep">Our story</p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-forest">
        From Indian pantries, with honesty
      </h1>

      <div className="motif-divider my-8 w-40" aria-hidden />

      <div className="space-y-5 text-[0.98rem] leading-relaxed text-ink-soft">
        <p>
          Annaadhya began with a familiar frustration: finding genuinely good honey, dry fruits and
          saffron at fair prices has become surprisingly hard. Shelves are full of inflated claims,
          mystery origins and pricing that has lost touch with reality. We wanted to do the opposite —
          start small, verify everything, and price honestly.
        </p>
        <p>
          We work directly with suppliers and buy in small batches. That keeps products fresh and keeps
          us honest: every batch is traceable, and every claim we publish — a floral source, an origin,
          a grade — appears on the product page only when supplier documents support it. Where something
          is still being verified, we say so plainly. You will see the words &quot;pending supplier
          confirmation&quot; on some of our pages. That is deliberate.
        </p>
        <p>
          Our promise is simple: <strong className="text-ink">premium quality at reasonable prices</strong>.
          No inflated MRPs, no invented certifications, no health claims we cannot back. Just good
          products, carefully packed, fairly priced.
        </p>
        <p>
          We are at the beginning of this journey. As supplier relationships deepen and our catalogue
          grows, this page — and every product page — will keep its receipts. If you ever have a question
          about what is in a jar or a pack, <strong className="text-ink">ask us</strong>. We answer.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { k: "Small batches", v: "Bought fresh, in quantities we can sell — never warehouse-aged stock." },
          { k: "Verified claims", v: "Published only with supplier documentation behind them." },
          { k: "Fair pricing", v: "Costed from real inputs; placeholder prices are labelled as such." },
        ].map((c) => (
          <div key={c.k} className="card-soft p-5">
            <h2 className="font-display font-semibold text-forest">{c.k}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="card-soft mt-10 p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Business information</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Annaadhya Products operates from Meerut, Uttar Pradesh, India. Company registration, GST and
          FSSAI licence details are being finalised and will be published here before launch — we will
          not display placeholders as if they were confirmed credentials.
        </p>
      </div>
    </div>
  );
}
