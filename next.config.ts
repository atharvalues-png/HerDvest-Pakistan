import type { NextConfig } from "next";

/**
 * STATIC_PREVIEW=1 builds only the public website as static files (for GitHub
 * Pages). The management system, investor portal and APIs need a Node server
 * and database, so the GitHub Pages workflow removes them before this build.
 */
const staticPreview = process.env.STATIC_PREVIEW === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = staticPreview
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { loader: "custom", loaderFile: "./src/lib/static-image-loader.ts" },
    }
  : {
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
