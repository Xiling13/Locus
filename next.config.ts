import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js Dev Tools "N" button (dev-only; not part of the app).
  devIndicators: false,
  // Check photos are data-URL JPEGs; allow a few MB through the vision proxy.
  experimental: {
    proxyClientMaxBodySize: "12mb",
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
