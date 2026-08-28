import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (only the files
  // actually needed at runtime) — this is what the Dockerfile copies into
  // the final image instead of the whole node_modules tree. Vercel has its
  // own serverless packaging and breaks when this is set (build fails
  // looking for .next/next-server.js.nft.json, a file only emitted in the
  // non-standalone output) — `process.env.VERCEL` is set automatically by
  // every Vercel build, so this only applies to self-hosted (Docker) builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // A nonce-based script-src (generated per-request in
            // middleware.ts) was tried and reverted this session: Next.js
            // 16 + Turbopack does not automatically stamp its own
            // App Router bootstrap/RSC scripts with the nonce the way
            // older Next.js documentation describes, so 'strict-dynamic'
            // blocked every one of them and broke hydration entirely
            // (confirmed via browser console — every _next/static chunk
            // and the inline __next_f payload scripts were rejected).
            // 'unsafe-inline' stays here until that's resolved upstream
            // or a working per-request nonce mechanism is found for this
            // Next.js/Turbopack combination.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
