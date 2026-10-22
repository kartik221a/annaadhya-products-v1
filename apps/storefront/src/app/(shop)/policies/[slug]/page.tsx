import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Policy pages — DRAFT CONTENT with explicit review markers.
 * These drafts must be reviewed/approved by the business before launch.
 * See docs/launch-checklist.md ("Legal & policy review").
 */
const POLICIES: Record<string, { title: string; updated: string; body: string[] }> = {
  shipping: {
    title: "Shipping & Delivery Policy",
    updated: "2026-10-19",
    body: [
      "**DRAFT — NOT LEGALLY REVIEWED. Business must confirm shipping partners, rates, SLAs and serviceable pincodes before launch.**",
      "We currently ship across India. Orders are dispatched within 2–3 working days of payment confirmation. Estimated delivery time after dispatch is 3–7 working days depending on your pincode; this estimate is a planning figure and is shown as guidance only, not a guarantee.",
      "Shipping charges: a flat fee applies per order, and orders above the free-shipping threshold visible at checkout ship free. The exact figures are configured by the business in admin settings and shown on the checkout page before you pay.",
      "Some remote pincodes may not be serviceable by our courier partners; if your pincode cannot be served, checkout will tell you before payment.",
      "For perishable-adjacent goods (honey can crystallise in cold weather; dry fruits are sensitive to heat) we pack to withstand normal transit conditions. If your parcel arrives damaged, contact us within 48 hours with photos and we will make it right.",
    ],
  },
  returns: {
    title: "Returns, Cancellations & Refunds Policy",
    updated: "2026-10-19",
    body: [
      "**DRAFT — NOT LEGALLY REVIEWED. Business must confirm the final returns window and refund SLA before launch.**",
      "Cancellations: you may cancel an unpaid or not-yet-dispatched order from your account page or by contacting support. Prepaid orders that are cancelled before dispatch are refunded in full to the original payment method within 5–7 working days (gateway processing times apply).",
      "Returns: because these are food products, we accept returns only for genuine quality issues, damaged shipments or wrong items. Contact us within 48 hours of delivery with your order number and photographs. Approved returns are refunded fully including shipping.",
      "Refunds are recorded through the original payment provider. Depending on your bank, refunds reflect in 5–7 working days. Cash-on-delivery refunds (when enabled) are made by bank transfer to the account you nominate.",
      "We cannot accept returns for change of mind on opened food products — this protects every customer's food safety.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "2026-10-19",
    body: [
      "**DRAFT — NOT LEGALLY REVIEWED. Must be reviewed against the Digital Personal Data Protection Act, 2023 and final data flows before launch.**",
      "What we collect: your name, contact details, delivery addresses and order history — only what is needed to fulfil your orders and support you. Sign-in is handled by Google Firebase Authentication; we never store passwords. If you sign in with Google or by email, we receive your verified identifier and basic profile.",
      "How we use it: to process orders, arrange delivery, provide support, prevent fraud, and — only with your explicit opt-in — to send occasional product news. You can opt out anytime from your account.",
      "Who we share it with: payment gateways (to process payments), courier partners (to deliver), and infrastructure providers (Firebase, hosting). We do not sell your personal data. Ever.",
      "Data location & retention: business records are stored in Google Cloud Firestore. We keep order records for statutory accounting periods; you may request deletion of your profile and non-transactional data from your account page, subject to identity verification.",
      "Contact for privacy requests: use the message form on our contact page — every enquiry is recorded and reviewed. Our official support address will be published there once the business confirms it.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    updated: "2026-10-19",
    body: [
      "**DRAFT — NOT LEGALLY REVIEWED. Business must confirm legal entity name, GST registration status and FSSAI licence details before launch.**",
      "These terms govern your use of the Annaadhya Products website. By placing an order you confirm you are at least 18 years old and providing accurate information.",
      "Products: we sell honey, dry fruits and saffron through our website. Product pages describe each item's pack sizes and price. Natural products vary batch to batch in colour, texture and aroma; product pages state what is verified and what is pending verification.",
      "Pricing & payment: all prices are in Indian Rupees and include applicable taxes where stated. We may update prices; the price shown at checkout is the price you pay. Payments are processed by our payment gateway partner; we do not store card details.",
      "Orders: an order is accepted when we confirm it after successful payment verification. In the rare case of pricing or stock errors, we will contact you and cancel with a full refund if you choose not to proceed.",
      "Liability: to the extent permitted by law, our liability for any claim relating to an order is limited to the order value. Nothing limits liability that cannot be limited by law.",
      "Governing law: these terms are governed by the laws of India; courts at Meerut, Uttar Pradesh have exclusive jurisdiction (to be confirmed by the business).",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  return { title: policy?.title ?? "Policy" };
}

/** Minimal **bold** renderer for the draft bodies. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className={p.includes("DRAFT") ? "text-berry" : "text-ink"}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-forest">{policy.title}</h1>
      <p className="mt-2 text-xs text-ink-soft">Draft updated {policy.updated}</p>
      <div className="mt-4 rounded-xl border border-honey/60 bg-honey/10 p-4 text-sm leading-relaxed text-ink">
        <strong>Draft notice:</strong> this page is editable draft content. It has not been reviewed by
        the business or a lawyer. All business details shown are placeholders pending approval — see the
        launch checklist in the project repository.
      </div>
      <div className="mt-8 space-y-5 text-[0.95rem] leading-relaxed text-ink-soft">
        {policy.body.map((para, i) => (
          <p key={i}>{renderInline(para)}</p>
        ))}
      </div>
    </article>
  );
}
