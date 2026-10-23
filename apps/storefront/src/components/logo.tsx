import Link from "next/link";
import Image from "next/image";

/**
 * Annaadhya brand lockup — official brand assets.
 *
 * Left:  the animated honey-drop video (800x800, ~8s seamless loop) — muted,
 *        autoplaying, plays inline on mobile, no native controls, circular
 *        badge crop. Its background is color-matched to the site's warm ivory
 *        surfaces, and the circular crop keeps it seamless on every canvas.
 * Right: the transparent name-only logo image (asset typography — never
 *        recreated as HTML text).
 *
 * Reduced motion: the video is hidden via `motion-reduce` and the static
 * standalone logo mark takes the exact same grid cell, so the brand stays
 * visible and aligned without JavaScript or layout shift. The video's poster
 * (a still of the animation's first frame) covers playback-unavailable cases.
 *
 * `dark` is accepted for call-site compatibility — both supplied assets are
 * transparent and read correctly on every canvas the design system uses.
 */

const VIDEO_SRC = "/brand/annaadhya-animated-logo.mp4";
const POSTER_SRC = "/brand/annaadhya-animated-logo-poster.jpg";
const STATIC_MARK_SRC = "/brand/annaadhya-logo.png";
const NAME_SRC = "/brand/annaadhya-name-logo.png";

export function Logo({
  height = 40,
  withWordmark = true,
  dark = false,
  compactOnMobile = false,
}: {
  /** Rendered size of the animated mark in px (the name lockup scales with it). */
  height?: number;
  withWordmark?: boolean;
  dark?: boolean;
  /** Hide the name logo below the sm breakpoint (animated mark only). Used by
   *  the sticky header so the lockup can never force horizontal overflow on phones. */
  compactOnMobile?: boolean;
}) {
  const nameHeight = Math.max(18, Math.round(height * 0.72));

  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Annaadhya Products home">
      {/* Animated mark + static reduced-motion fallback stacked in one grid cell. */}
      <span className="grid shrink-0" style={{ height, width: height }}>
        <video
          className="col-start-1 row-start-1 h-full w-full rounded-full object-contain motion-reduce:hidden"
          width={800}
          height={800}
          style={{ height, width: height }}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          aria-hidden="true"
        />
        <Image
          className="col-start-1 row-start-1 h-full w-full object-contain motion-safe:hidden"
          src={STATIC_MARK_SRC}
          alt=""
          width={477}
          height={512}
          unoptimized
        />
      </span>

      {withWordmark && (
        <Image
          src={NAME_SRC}
          alt=""
          width={1023}
          height={285}
          priority
          unoptimized
          className={compactOnMobile ? "hidden sm:block" : ""}
          style={{ height: nameHeight, width: "auto" }}
        />
      )}
    </Link>
  );
}
