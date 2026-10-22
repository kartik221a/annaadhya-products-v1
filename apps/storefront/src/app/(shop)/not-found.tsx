import Link from "next/link";
import { IconSearchOff } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-gutter-mobile py-space-xl text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-primary-container"
        aria-hidden
      >
        <IconSearchOff size={30} />
      </span>
      <h1 className="font-display mt-space-lg text-headline-lg-mobile font-semibold text-on-surface">
        This page has wandered off the shelf
      </h1>
      <p className="mt-space-md max-w-md text-body-md leading-relaxed text-on-surface-variant">
        The link may be old, or the product may have been archived. The shop is one click away.
      </p>
      <div className="mt-space-xl flex flex-wrap justify-center gap-3">
        <Link href="/shop" className="btn-primary px-6 py-2.5 text-label-lg">Browse the shop</Link>
        <Link href="/" className="btn-outline px-6 py-2.5 text-label-lg">Go home</Link>
      </div>
    </div>
  );
}
