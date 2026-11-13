import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verasjuris.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/portal/", "/api/", "/checkout/", "/session/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
