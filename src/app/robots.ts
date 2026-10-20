import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** Search and AI crawlers are welcome on the public pages; signed-in pages and endpoints stay out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/consent", "/sign-in", "/api/", "/mcp"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
