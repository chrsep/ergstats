import type { MetadataRoute } from "next";

import { SITE_URL, guideClients } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...guideClients().map((c) => ({ url: `${SITE_URL}/connect/${c.id}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
