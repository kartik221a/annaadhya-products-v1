import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import { getCategories, getPlatformStatus } from "@/lib/api";
import { AnnouncementStrip, Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Annaadhya Products — Honey, Dry Fruits & Kesar",
    template: "%s | Annaadhya Products",
  },
  description:
    "Premium-quality honey, dry fruits and kesar at reasonable prices. Packed for Indian homes with every claim verified before publication.",
  openGraph: {
    type: "website",
    siteName: "Annaadhya Products",
    title: "Annaadhya Products — Honey, Dry Fruits & Kesar",
    description: "Premium-quality honey, dry fruits and kesar at reasonable prices.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, status] = await Promise.all([getCategories(), getPlatformStatus()]);
  const announcement = status
    ? "Demo catalogue live — prices are illustrative placeholders pending approval."
    : "Annaadhya — premium honey, dry fruits & kesar.";
  const readyCategories = categories.filter((c) => c.isReady);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <CartProvider>
            <AnnouncementStrip message={announcement} href="/shop" />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer categories={readyCategories.map((c) => ({ slug: c.slug, name: c.name }))} />
          </CartProvider>
        </AuthProvider>
        <noscript>
          <p className="p-4 text-center text-sm">
            Some features need JavaScript. Browse our <Link href="/shop">catalogue</Link> anytime.
          </p>
        </noscript>
      </body>
    </html>
  );
}
