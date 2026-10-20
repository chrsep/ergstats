import type { NextConfig } from "next";

/**
 * Sent with every response. Vercel adds Strict-Transport-Security on its own.
 * The pages that matter most here are /sign-in and /consent: an OAuth
 * authorization UI must never render inside another site's frame.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // PostHog's browser SDK posts to paths ending in a slash (/e/, /i/v0/e/).
  // Next.js would answer each with a redirect, costing every analytics batch
  // a round trip, so the usual trailing-slash redirect is kept for every path
  // except the analytics relay.
  skipTrailingSlashRedirect: true,
  redirects() {
    return [{ source: "/:path((?!pulse/).+)/", destination: "/:path", permanent: true }];
  },
};

export default nextConfig;
