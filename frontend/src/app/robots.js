import { SITE_ORIGIN, preview } from "../lib/seo";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: preview ? undefined : "/",
      disallow: preview
        ? "/"
        : ["/app/", "/institution", "/api/", "/demo", "/offline"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
