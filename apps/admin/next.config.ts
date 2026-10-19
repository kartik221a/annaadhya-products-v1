import path from "node:path";
import type { NextConfig } from "next";

/**
 * Minimal Next config. The admin panel is a client-rendered console behind auth:
 * API calls go directly from the browser to the NestJS API (NEXT_PUBLIC_API_URL),
 * so no rewrites/proxies are configured here.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The monorepo lives inside a larger workspace tree; pin tracing to this repo's root
  // so Next does not guess from other lockfiles it may find upwards.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
