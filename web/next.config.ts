import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The "Create an ad" form sends a picture (max 5 MB) and a video (max 30 MB) with the text (Session 3b). Keep this above
  // adsConfig.media.imageMaxBytes + videoMaxBytes; the exact limits are checked again in src/lib/ad-media.ts.
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
  partialPrefetching: true,
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
