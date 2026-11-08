import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The "Create an ad" form sends a picture (up to 25 MB, the server shrinks it) and a video (max 30 MB) with the text. Keep this above
  // adsConfig.media.imageUploadMaxBytes + videoMaxBytes; the exact limits are checked again in src/lib/ad-media.ts.
  experimental: { serverActions: { bodySizeLimit: "60mb" } },
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
