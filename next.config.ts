import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js Dev Tools "N" button (dev-only; not part of the app).
  devIndicators: false,
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
