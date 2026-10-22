import Link from "next/link";
import Image from "next/image";

/** Annaadhya brand lockup — the brand emblem (cropped from Kartik's supplied logo,
 *  background removed) plus the two-line wordmark from the approved design. */
export function Logo({
  height = 36,
  withWordmark = true,
  dark = false,
  compactOnMobile = false,
}: {
  height?: number;
  withWordmark?: boolean;
  dark?: boolean;
  /** Hide the wordmark below the sm breakpoint (icon-only brand mark). Used by the
   *  sticky header so the lockup can never force horizontal overflow on phones. */
  compactOnMobile?: boolean;
}) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Annaadhya Products home">
      <Image
        src="/images/logo-mark.webp"
        alt=""
        width={Math.round(height * 1.3)}
        height={height}
        priority
        className="h-auto w-auto object-contain"
        style={{ height, width: "auto" }}
      />
      {withWordmark && (
        <span className={`leading-tight ${compactOnMobile ? "hidden sm:block" : ""}`}>
          <span
            className={`font-display block font-bold tracking-tight text-[1.1rem] leading-6 sm:text-[1.375rem] sm:leading-7 ${
              dark ? "text-primary-container" : "text-primary"
            }`}
          >
            Annaadhya Products
          </span>
          <span className="block text-label-sm uppercase tracking-[0.2em] text-on-tertiary-container">
            Artisanal Pantry
          </span>
        </span>
      )}
    </Link>
  );
}
