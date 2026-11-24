import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/guides";

// Pages that must stay out of search (tag, share and display pages) say noindex themselves; they are not
// blocked here, or a crawler could not read that.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
