import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Ordering, shipping, honey crystallisation and more — answered plainly.",
};

const FAQS = [
  {
    q: "Is your honey pure?",
    a: "We publish only what we can verify with supplier documents for the batch being sold. We do not use the words 'pure' or 'organic' as marketing labels — when a batch has test documentation, the product page states exactly what was tested and by whom. Until then, we say what is verified and what is pending.",
  },
  {
    q: "Why has my honey crystallised or changed texture?",
    a: "Crystallisation is a natural process in many floral honeys and is not a sign of spoilage — it depends on the blossoms the bees visited and the storage temperature. To reliquefy, place the jar in warm (not boiling) water. Honey's high acidity and low moisture keep it stable for a long time when stored sealed, away from direct sunlight.",
  },
  {
    q: "Are your prices final?",
    a: "The catalogue currently runs on clearly-labelled demo prices while supplier negotiations finish. The price you see at checkout is always the price you pay — totals are calculated on our servers, never in your browser.",
  },
  {
    q: "Where do you deliver, and how long does it take?",
    a: "We ship across India via courier partners. Orders dispatch within 2–3 working days, and delivery typically takes 3–7 working days after dispatch. If your pincode is not serviceable, checkout will tell you before payment.",
  },
  {
    q: "How do returns work for food products?",
    a: "For genuine quality issues, damaged parcels or wrong items, contact us within 48 hours with photographs — we refund fully including shipping. We cannot accept returns of opened products for change of mind; that protects every customer's food safety. Read the full policy under Returns & refunds.",
  },
  {
    q: "Do you sell gift boxes?",
    a: "Our curated gift-box collection is in preparation — it will combine honey, dry fruits and kesar for festivals and corporate gifting. Until then, you can order multiple products together and we will pack them thoughtfully; mention gifting in the order notes or contact us.",
  },
  {
    q: "How do I create an account?",
    a: "Click 'Sign in' in the header. You can register with email and password, or continue with Google. Guest checkout is also available — an account just makes reordering and tracking easier.",
  },
  {
    q: "Is my payment information safe?",
    a: "Payments are handled by our payment gateway partner; we never see or store your card details. During the demo phase, payments run through a sandbox — no real money moves until the business approves the production launch.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-forest">Frequently asked questions</h1>
      <p className="mt-2 text-sm text-ink-soft">Plain answers, no marketing fog. Something missing? <Link href="/contact" className="text-forest underline">Contact us</Link>.</p>

      <div className="mt-8 space-y-3">
        {FAQS.map((f, i) => (
          <details key={i} className="card-soft group p-5" open={i === 0}>
            <summary className="cursor-pointer list-none font-display text-[1.05rem] font-semibold text-ink marker:hidden">
              <span className="mr-2 text-honey-deep" aria-hidden>›</span>
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
