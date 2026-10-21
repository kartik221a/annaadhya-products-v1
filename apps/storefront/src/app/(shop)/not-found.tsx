import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>🍯</p>
      <h1 className="font-display mt-5 text-3xl font-semibold text-forest">This page has wandered off the shelf</h1>
      <p className="mt-3 text-sm text-ink-soft">
        The link may be old, or the product may have been archived. The shop is one click away.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/shop" className="btn-primary px-6 py-2.5 text-sm">Browse the shop</Link>
        <Link href="/" className="btn-outline px-6 py-2.5 text-sm">Go home</Link>
      </div>
    </div>
  );
}
