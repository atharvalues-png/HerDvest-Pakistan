import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { legalPages } from "@/content/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/how-it-works", "/services", "/investors", "/calculator", "/farmers", "/about", "/faq", "/contact"];
  return [
    ...routes.map((r) => ({ url: `${site.url}${r}`, changeFrequency: "monthly" as const, priority: r === "" ? 1 : 0.8 })),
    ...Object.keys(legalPages).map((k) => ({ url: `${site.url}/legal/${k}`, priority: 0.3 })),
  ];
}
