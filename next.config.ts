import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Avoid module resolution issues: only set if you have multiple lockfiles
  // outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
