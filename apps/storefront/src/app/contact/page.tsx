import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSettings } from "@/lib/api";
import type { PublicStoreSettings } from "@/lib/types";
import {
  IconClock,
  IconGift,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about orders, products or gifting — talk to Annaadhya.",
};

/** Used only when the API is unreachable (build/preview). Values mirror the seeded
 *  settings defaults, so the page never renders invented contact details. */
const FALLBACK_SETTINGS: PublicStoreSettings = {
  store: {
    name: "Annaadhya",
    supportEmail: "support@annaadhya.example",
    supportPhone: "",
    addressLines: [],
    socialLinks: {},
    announcement: { enabled: false, message: "" },
  },
  storefront: { newsletterEnabled: true, giftCollectionEnabled: true },
};

const GIFTING_MAILTO = {
  subject: encodeURIComponent("Corporate gifting enquiry"),
  body: encodeURIComponent(
    "Occasion: \nBudget per gift (₹): \nQuantity: \nDelivery city & date: \nAnything else: ",
  ),
};

export default async function ContactPage() {
  const settings = (await getPublicSettings()) ?? FALLBACK_SETTINGS;
  const { store } = settings;
  const isPlaceholderEmail = /\.example$/i.test(store.supportEmail);
  const hasPhone = Boolean(store.supportPhone.trim());
  const hasAddress = store.addressLines.length > 0;
  const socials = Object.entries(store.socialLinks).filter(([, url]) => Boolean(url));

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-5xl px-margin-mobile pb-space-xl pt-space-xl lg:px-margin">
        {/* Hero */}
        <header className="max-w-2xl">
          <span className="mb-space-xs block text-label-md uppercase tracking-[0.2em] text-primary">
            Customer Care
          </span>
          <h1 className="font-display text-headline-lg-mobile lg:text-headline-lg leading-tight tracking-tight text-on-surface">
            Contact Annaadhya
          </h1>
          <p className="mt-space-md text-body-lg leading-relaxed text-on-surface-variant">
            Questions about a product, an order, or a gift? We reply within one working day.
            During the catalogue-verification phase we are especially happy to talk about
            sourcing and quality documentation.
          </p>
          <p className="mt-space-md inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-4 py-2 text-label-lg text-on-surface">
            <IconClock size={16} className="text-on-tertiary-container" />
            We reply within one working day
          </p>
        </header>

        {/* Channels */}
        <section aria-label="Ways to reach us" className="mt-space-xl grid gap-space-md sm:grid-cols-2">
          <div className="card-soft p-space-md">
            <p className="flex items-center gap-space-xs text-label-md uppercase tracking-[0.08em] text-primary">
              <IconMail size={18} className="text-on-tertiary-container" />
              Email
            </p>
            <p className="mt-space-sm text-body-md text-on-surface">
              {isPlaceholderEmail ? (
                <span className="font-medium">{store.supportEmail}</span>
              ) : (
                <a
                  href={`mailto:${store.supportEmail}?subject=${encodeURIComponent("Annaadhya enquiry")}`}
                  className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary-container"
                >
                  {store.supportEmail}
                </a>
              )}
            </p>
            {isPlaceholderEmail && (
              <p className="mt-space-xs text-body-sm text-on-surface-variant">
                Placeholder — the official support address is confirmed before launch.
              </p>
            )}
          </div>

          {hasPhone && (
            <div className="card-soft p-space-md">
              <p className="flex items-center gap-space-xs text-label-md uppercase tracking-[0.08em] text-primary">
                <IconPhone size={18} className="text-on-tertiary-container" />
                Phone
              </p>
              <p className="mt-space-sm text-body-md font-medium text-on-surface">{store.supportPhone}</p>
              <p className="mt-space-xs text-body-sm text-on-surface-variant">
                Monday to Saturday, 10am – 6pm IST.
              </p>
            </div>
          )}

          {hasAddress && (
            <div className="card-soft p-space-md">
              <p className="flex items-center gap-space-xs text-label-md uppercase tracking-[0.08em] text-primary">
                <IconMapPin size={18} className="text-on-tertiary-container" />
                Write to us
              </p>
              <address className="mt-space-sm text-body-md not-italic leading-relaxed text-on-surface">
                {store.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="mt-space-xs text-body-sm text-on-surface-variant">
                The full legal address appears on invoices.
              </p>
            </div>
          )}

          {socials.length > 0 && (
            <div className="card-soft p-space-md">
              <p className="text-label-md uppercase tracking-[0.08em] text-primary">Elsewhere</p>
              <ul className="mt-space-sm space-y-space-xs text-body-md">
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold capitalize text-primary underline underline-offset-4 transition-colors hover:text-primary-container"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Corporate gifting */}
        <section aria-label="Corporate gifting" className="mt-space-xl overflow-hidden rounded-lg bg-primary shadow-[0_18px_50px_-18px_rgb(84_22_32/0.5)]">
          <div className="flex flex-col gap-space-lg p-space-lg sm:flex-row sm:items-center">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-on-primary/10">
              <IconGift size={26} className="text-tertiary-fixed" />
            </div>
            <div className="flex-grow">
              <h2 className="font-display text-headline-md text-surface">Corporate &amp; Festive Gifting</h2>
              <p className="mt-space-sm max-w-2xl text-body-md leading-relaxed text-on-primary/85">
                Curated pantry hampers for employee welcomes, client festive gifts and milestone
                celebrations. Write with the occasion, the budget per gift and the quantity — we
                respond with a curated shortlist and samples where it helps.
              </p>
            </div>
            <a
              href={`mailto:${store.supportEmail}?subject=${GIFTING_MAILTO.subject}&body=${GIFTING_MAILTO.body}`}
              className="btn-secondary shrink-0 self-start px-space-md py-3 text-label-lg uppercase tracking-wider sm:self-center"
            >
              Start a gifting enquiry
            </a>
          </div>
        </section>

        {/* Before you write */}
        <section aria-label="Before you write" className="card-soft mt-space-xl p-space-md">
          <h2 className="font-display text-headline-sm text-on-surface">Before you write</h2>
          <ul className="mt-space-md space-y-space-sm text-body-md text-on-surface-variant">
            <li className="flex gap-space-sm">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tertiary" />
              <span>
                Order status &amp; tracking: check{" "}
                <Link href="/account" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-container">
                  Account → Order history
                </Link>{" "}
                first — it updates in real time.
              </span>
            </li>
            <li className="flex gap-space-sm">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tertiary" />
              <span>
                Damaged parcel? Send photos within 48 hours with your order number for a fast
                resolution.
              </span>
            </li>
            <li className="flex gap-space-sm">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tertiary" />
              <span>
                Shipping, returns and payment questions are answered in{" "}
                <Link href="/faq" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-container">
                  the FAQ
                </Link>
                .
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
