import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // The GitHub Pages preview contains placeholder company details: keep it out of search engines.
  if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/management", "/portal"] }, sitemap: `${site.url}/sitemap.xml` };
}
