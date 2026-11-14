
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "7mb",
    },
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
