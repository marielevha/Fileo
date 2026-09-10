import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * Public pages only (§6.2): the workshop space and the back-office are
 * excluded from indexing, and each carries `robots: noindex` of its own.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: Array<[path: string, priority: number]> = [
    ["", 1],
    ["/prise-en-main", 0.8],
    ["/faq", 0.7],
    ["/nouveautes", 0.6],
    ["/contact", 0.5],
    ["/mentions-legales", 0.3],
    ["/politique-de-confidentialite", 0.3],
    ["/cgv", 0.3],
  ];

  return pages.map(([path, priority]) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  }));
}
