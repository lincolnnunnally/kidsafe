import type { MetadataRoute } from "next";
import { SITE_ORIGIN, listGuides } from "@/lib/guides";

// Kid Safe's public pages, plus each published guide (read live from the shared writing store; if that read
// fails, the fixed pages are still listed). Tag, share and display pages are private and stay out.
export const revalidate = 600;

const PAGES = ["/", "/family", "/partners", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = await listGuides();
  return [
    ...PAGES.map((path) => ({ url: `${SITE_ORIGIN}${path}` })),
    ...(guides.length ? [{ url: `${SITE_ORIGIN}/guides` }] : []),
    ...guides.map((g) => ({
      url: `${SITE_ORIGIN}/guides/${g.slug}`,
      ...(g.publishedAt ? { lastModified: g.publishedAt } : {}),
    })),
  ];
}
