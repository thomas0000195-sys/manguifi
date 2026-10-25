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

  // Fichiers de liaison de domaine (Android et iOS) : réécriture interne, sans redirection.
  async rewrites() {
    return [
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/assetlinks" },
      { source: "/.well-known/apple-app-site-association", destination: "/api/well-known/apple-app-site-association" },
    ];
  },

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
        ],
      },
    ];
  },
};

export default nextConfig;
