import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about orders, products or gifting — talk to Annaadhya.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-forest">Contact Annaadhya</h1>
      <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">
        Questions about a product, an order, or a gift? We reply within one working day. During the
        catalogue-verification phase we are especially happy to talk about sourcing and quality
        documentation.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card-soft p-5">
          <h2 className="font-display font-semibold text-forest">Customer support</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Email: <span className="font-medium text-ink">support@annaadhya.example</span>
            <br />
            <span className="text-xs">(placeholder — the official support address is confirmed before launch)</span>
          </p>
        </div>
        <div className="card-soft p-5">
          <h2 className="font-display font-semibold text-forest">Business correspondence</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Annaadhya Products, Baghpat Road, Meerut, Uttar Pradesh 250002, India.
            <br />
            <span className="text-xs">(Business chooses what to publish; full legal address appears on invoices.)</span>
          </p>
        </div>
      </div>

      <div className="card-soft mt-6 p-5">
        <h2 className="font-display font-semibold text-forest">Before you write</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Order status &amp; tracking: check <strong>Account → Order history</strong> first — it updates in real time.</li>
          <li>Damaged parcel? Send photos within 48 hours with your order number for a fast resolution.</li>
          <li>Gifting enquiries: tell us the occasion, budget and quantity — we are building the gift collection now.</li>
        </ul>
      </div>
    </div>
  );
}
