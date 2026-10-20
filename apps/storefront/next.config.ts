import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Brand imagery is pre-optimized WebP in /public/images; product imagery is
    // SVG placeholders (Cloudinary photography later). The Vercel image optimizer
    // (/_next/image) is unreachable in this services-mode deployment — the root
    // catch-all rewrite forwards it to the storefront app, which 404s — so
    // next/image renders direct, already-sized sources instead.
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
  },
};

export default nextConfig;
