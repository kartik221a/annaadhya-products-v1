import Link from "next/link";

/** Annaadhya logo — hexagon honeycomb motif with leaf, matching the brand mark's geometry. */
export function Logo({ size = 40, withWordmark = true, dark = false }: { size?: number; withWordmark?: boolean; dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Annaadhya Products home">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill={dark ? "#FBF7EF" : "#1E4D3B"} opacity={dark ? 1 : 0.08} />
        <path
          d="M24 8l6.9 4v8L24 24l-6.9-4v-8L24 8z"
          fill="#C99A3C"
        />
        <path
          d="M24 24l6.9 4v8L24 40l-6.9-4v-8l6.9-4z"
          fill={dark ? "#1E4D3B" : "#FBF7EF"}
          stroke={dark ? "#FBF7EF" : "#1E4D3B"}
          strokeWidth="1.2"
        />
        <path
          d="M17.1 20v8L10 24v-8l7.1 4zM30.9 20v8l7.1-4v-8l-7.1 4z"
          fill={dark ? "#C99A3C" : "#C99A3C"}
          opacity="0.75"
        />
        <path d="M31 14c3-1.4 5.6-1 7 .8-1.9 1.3-4.5 1.4-7-.8z" fill="#2C6650" />
      </svg>
      {withWordmark && (
        <span className="leading-tight">
          <span className={`font-display block text-[1.05rem] font-semibold tracking-tight ${dark ? "text-cream" : "text-forest"}`}>
            Annaadhya
          </span>
          <span className={`block text-[0.6rem] font-bold uppercase tracking-[0.32em] ${dark ? "text-honey" : "text-berry"}`}>
            Products
          </span>
        </span>
      )}
    </Link>
  );
}
