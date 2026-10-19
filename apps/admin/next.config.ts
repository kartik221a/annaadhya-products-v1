import path from "node:path";
import type { NextConfig } from "next";

/**
 * Minimal Next config. The admin panel is a client-rendered console behind auth:
 * API calls go directly from the browser to the NestJS API, so no rewrites/proxies
 * are configured here.
 *
 * On Vercel (services mode) the admin service is mounted under the /admin path
 * prefix via the top-level rewrite in the root vercel.json — basePath keeps the
 * app's routes and static assets aligned with that public path.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: "/admin",
  // The monorepo lives inside a larger workspace tree; pin tracing to this repo's root
  // so Next does not guess from other lockfiles it may find upwards.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
