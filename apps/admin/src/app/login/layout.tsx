import type { Metadata } from "next";
import localFont from "next/font/local";

/**
 * Login route layout: document title + the self-hosted heritage fonts.
 *
 * Both families are SIL OFL latin variable subsets committed under src/fonts —
 * next/font/local serves them basePath-safely and wires the CSS variables used
 * by .font-heritage-display / .font-heritage-sans in globals.css. Scoped to this
 * layout only, so the rest of the console keeps its existing type until its own
 * page redesign lands.
 */
const playfair = localFont({
  src: [
    { path: "../../fonts/playfair-display-latin-var.woff2", weight: "400 900", style: "normal" },
    { path: "../../fonts/playfair-display-latin-var-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-heritage-display",
  display: "swap",
});

const jakarta = localFont({
  src: "../../fonts/plus-jakarta-sans-latin-var.woff2",
  weight: "200 800",
  variable: "--font-heritage-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} ${jakarta.variable}`}>{children}</div>
  );
}
