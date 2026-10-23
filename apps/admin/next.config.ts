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
  // Tracing root MUST be the monorepo root, never apps/admin. With the root pinned to
  // apps/admin, Vercel's serverless file tracing excluded the workspace packages that
  // live outside apps/admin (packages/contracts etc.), so the on-demand SSR lambda for
  // dynamic routes (e.g. /products/[id], /orders/[id]) crashed with a 500 on every
  // request while statically prerendered pages kept working. Pinning to the repo root
  // keeps the same guard against stray parent lockfiles AND gives the lambda the full
  // dependency closure.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
