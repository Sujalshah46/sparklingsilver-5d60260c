import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://sparklingsilver.in";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/catalogue", changefreq: "daily", priority: "0.9" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          
          { path: "/blog/silver-price-calculation-guide", changefreq: "monthly", priority: "0.6" },
          { path: "/blog/925-vs-999-silver", changefreq: "monthly", priority: "0.6" },
          { path: "/blog/bis-hallmarking-explained", changefreq: "monthly", priority: "0.6" },
        ];

        const [{ data: categories }, { data: products }] = await Promise.all([
          supabase.from("categories").select("slug").in("slug", ["antique", "cz"]),
          supabase.from("products").select("slug, created_at"),
        ]);

        const entries: SitemapEntry[] = [
          ...staticEntries,
          ...(categories ?? []).map((c) => ({
            path: `/category/${c.slug}`,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
          ...(products ?? []).map((p) => ({
            path: `/product/${p.slug}`,
            lastmod: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : undefined,
            changefreq: "weekly" as const,
            priority: "0.7",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
