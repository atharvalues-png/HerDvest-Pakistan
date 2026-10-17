import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows a production build to run alongside the dev server (NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pg is a Node-only dependency used by server code.
  serverExternalPackages: ["pg"],
  experimental: {
    // allow photo/receipt uploads through server-action forms
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
