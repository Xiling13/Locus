import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js Dev Tools "N" button (dev-only; not part of the app).
  devIndicators: false,
  // Let phones on the LAN load /_next/* during `next dev` (otherwise only the
  // SSR splash renders and the app looks "stuck" on the locus logo).
  allowedDevOrigins: ["192.168.2.10", "*.local"],
  // Check photos are data-URL JPEGs; allow a few MB through the vision proxy.
  experimental: {
    proxyClientMaxBodySize: "12mb",
  },
  // Safari pins the first /favicon.ico it ever saw (the old Next.js "N").
  // Force revalidation so a deploy can replace it after the user reloads.
  async headers() {
    return [
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
