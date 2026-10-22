import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconCalendar,
  IconHeadset,
  IconPenLine,
  IconRefresh,
  IconShieldCheck,
  IconTruck,
} from "@/components/icons";

/**
 * Policy pages — DRAFT CONTENT with explicit review markers.
 * These drafts must be reviewed/approved by the business before launch.
 * See docs/launch-checklist.md ("Legal & policy review").
 *
 * Presentation follows the approved heritage design system (M3 tokens, the same
 * page family as /about, /contact and /faq). The legal wording itself is verbatim
 * draft copy — only the business (or its lawyer) may change what a policy says.
 */
type PolicyMeta = {
  title: string;
  /** Short honest summary — used in <meta> descriptions and the sibling cards. */
  description: string;
  updated: string;
  body: string[];
};

const POLICIES: Record<string, PolicyMeta> = {
  shipping: {
    title: "Shipping & Delivery Policy",
    description:
      "Dispatch timelines, honest delivery estimates, shipping charges, and what happens if a parcel arrives damaged.",
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
    description:
      "How to cancel before dispatch, when returns are accepted for food-safety reasons, and how refunds are processed.",
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
    description:
      "What we collect, how it is used to fulfil orders and support you, and the choices you have over your data.",
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
    description:
      "The ground rules for ordering from Annaadhya Products — pricing, payments, order acceptance and liability.",
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

const POLICY_ICONS: Record<string, typeof IconTruck> = {
  shipping: IconTruck,
  returns: IconRefresh,
  privacy: IconShieldCheck,
  terms: IconPenLine,
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return { title: "Policy" };
  return {
    title: policy.title,
    description: policy.description,
    openGraph: {
      title: `${policy.title} | Annaadhya Products`,
      description: policy.description,
      type: "website",
      siteName: "Annaadhya Products",
    },
  };
}

/** Minimal **bold** renderer for the draft bodies. DRAFT markers carry the error
 *  tone so "not legally reviewed" can never read as settled copy. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className={p.includes("DRAFT") ? "font-semibold text-error" : "font-semibold text-on-surface"}>
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  const siblings = Object.entries(POLICIES).filter(([key]) => key !== slug);

  return (
    <div className="bg-surface">
      {/* ==================== HEADER ==================== */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-container-low/70 via-surface to-surface"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-margin-mobile pb-space-lg pt-space-lg text-center lg:pt-space-xl">
          {/* Eyebrow with antique-gold motifs (same family as /faq) */}
          <div className="mb-3 flex items-center gap-3">
            <svg className="h-2 w-6 text-tertiary-fixed-dim" viewBox="0 0 24 8" fill="currentColor" aria-hidden>
              <circle cx="2" cy="4" r="2" />
              <rect x="8" y="3.25" width="16" height="1.5" rx="0.75" />
            </svg>
            <span className="text-label-sm font-bold uppercase tracking-[0.25em] text-tertiary-container">
              Store policies
            </span>
            <svg className="h-2 w-6 text-tertiary-fixed-dim" viewBox="0 0 24 8" fill="currentColor" aria-hidden>
              <rect x="0" y="3.25" width="16" height="1.5" rx="0.75" />
              <circle cx="22" cy="4" r="2" />
            </svg>
          </div>
          <h1 className="font-display text-headline-lg-mobile font-semibold text-on-surface lg:text-headline-lg">
            {policy.title}
          </h1>
          <div className="mt-space-md flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-label-md text-on-surface-variant">
              <IconCalendar size={14} aria-hidden />
              Last reviewed {policy.updated}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1 text-label-md text-on-tertiary-fixed-variant">
              <IconPenLine size={14} aria-hidden />
              Draft pending business review
            </span>
          </div>
        </div>
      </section>

      {/* ==================== DRAFT NOTICE ==================== */}
      <section aria-label="Draft notice" className="px-margin-mobile lg:px-margin">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3 rounded-md border border-tertiary-fixed-dim bg-tertiary-fixed/40 p-space-md">
            <IconPenLine size={20} className="mt-0.5 shrink-0 text-on-tertiary-fixed-variant" aria-hidden />
            <p className="text-body-sm leading-relaxed text-on-tertiary-fixed-variant">
              <strong className="font-semibold">Draft notice:</strong> this page is editable draft content. It has
              not been reviewed by the business or a lawyer. All business details shown are placeholders pending
              approval — see the launch checklist in the project repository.
            </p>
          </div>
        </div>
      </section>

      {/* ==================== BODY ==================== */}
      <article className="px-margin-mobile py-space-lg lg:px-margin">
        <div className="mx-auto max-w-3xl space-y-space-md">
          {policy.body.map((para, i) => (
            <p key={i} className="text-body-md leading-relaxed text-on-surface-variant">
              {renderInline(para)}
            </p>
          ))}
        </div>
      </article>

      {/* ==================== OTHER POLICIES ==================== */}
      <section aria-label="Other store policies" className="px-margin-mobile pb-space-lg lg:px-margin">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-headline-sm text-on-surface">Other store policies</h2>
          <div className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-3">
            {siblings.map(([siblingSlug, sibling]) => {
              const SiblingIcon = POLICY_ICONS[siblingSlug];
              return (
                <Link
                  key={siblingSlug}
                  href={`/policies/${siblingSlug}`}
                  className="card-soft group flex items-start gap-3 p-space-md transition-shadow hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary-container">
                    <SiblingIcon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-label-lg font-semibold text-on-surface transition-colors group-hover:text-primary">
                      {sibling.title}
                    </span>
                    <span className="mt-1 block text-body-sm leading-relaxed text-on-surface-variant">
                      {sibling.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== QUESTIONS CTA ==================== */}
      <section aria-label="Questions about this policy" className="px-margin-mobile pb-space-xl lg:px-margin">
        <div className="mx-auto max-w-3xl">
          <div className="card-soft flex flex-col items-center gap-space-md p-space-xl text-center sm:flex-row sm:text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary-container">
              <IconHeadset size={24} aria-hidden />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-headline-sm text-on-surface">Questions about this policy?</h2>
              <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                Write to us through the contact page — every enquiry is recorded, and we reply within one working
                day, Monday to Saturday.
              </p>
            </div>
            <Link href="/contact" className="btn-primary shrink-0 px-5 py-2.5 text-label-lg">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
