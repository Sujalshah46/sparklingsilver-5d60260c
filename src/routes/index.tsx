import { pageTitle } from "@/lib/seo";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";

import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { AccessBanner } from "@/components/AccessBanner";
import { CategoryTile } from "@/components/CategoryTile";
import { VideoShowcase } from "@/components/VideoShowcase";
import { resolveProductImage, PREMIUM_CATEGORY_IMAGES } from "@/lib/product-images";



type CategoryRow = { id: string; slug: string; name: string; sort_order?: number | null; image_url?: string | null };

const HOME_SLUGS = ["antique", "cz"] as const;

const homeQuery = queryOptions({
  queryKey: ["home"],
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  queryFn: async () => {
    // 3 parallel round-trips total: featured products, visible categories,
    // and a single RPC returning all category counts (replaces N head-count
    // queries).
    const [featuredRes, categoriesRes, countsRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("homepage_featured", true)
        .order("homepage_featured_order", { ascending: true })
        .limit(10),
      supabase
        .from("categories")
        .select("id,slug,name,sort_order,image_url")
        .in("slug", HOME_SLUGS as unknown as string[])
        .order("sort_order"),
      supabase.rpc("get_category_product_counts", { _slugs: HOME_SLUGS as unknown as string[] }),
    ]);
    const categories = (categoriesRes.data ?? []) as CategoryRow[];
    const countRows = (countsRes.data ?? []) as Array<{ slug: string; product_count: number }>;
    const countsBySlug = new Map(countRows.map((r) => [r.slug, Number(r.product_count) || 0]));
    const counts = new Map<string, number>(
      categories.map((c) => [c.id, countsBySlug.get(c.slug) ?? 0]),
    );
    let total = 0;
    for (const n of counts.values()) total += n;
    return {
      categories,
      products: (featuredRes.data ?? []) as CatalogueCardData[],
      counts,
      total,
    };
  },
});


const HOME_TITLE = pageTitle("Premium Indian Jewellery");
const HOME_DESC = "Wholesale 925 sterling silver jewellery catalogue — premium silver designs across rings, earrings, pendants, bangles, anklets and more.";

const CATEGORY_UNSPLASH = PREMIUM_CATEGORY_IMAGES;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: "https://sparklingsilver.in/" },
      { property: "og:image", content: "https://sparklingsilver.in/og-home.jpg" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [
      { rel: "canonical", href: "https://sparklingsilver.in/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JewelryStore",
          name: "Sparkling Silver",
          url: "https://sparklingsilver.in",
          image: "https://sparklingsilver.in/og-home.jpg",
          telephone: "+91-99999-99999",
        }),
      },
    ],
  }),
  loader: undefined,
  component: Home,
});




function SectionHeader({ title, total, to }: { title: string; total?: number | string; to?: string }) {
  return (
    <div className="px-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="section-heading">{title}</p>
          {typeof total !== "undefined" && (
            <p className="mt-0.5 text-[11px] text-[#888]">Total Products: {total}</p>
          )}
        </div>
        {to && (
          <Link
            to={to}
            className="rounded-[2px] border border-teal px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-teal hover:bg-teal hover:text-white"
          >
            View All
          </Link>
        )}
      </div>
      <span className="section-underline mt-2" />
    </div>
  );
}

function Home() {
  // Client-side fetch: no SSR blocking; shell paints immediately.
  const { data } = useQuery(homeQuery);
  const [style, setStyle] = useState<"premium" | "classic">("premium");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("sj.categoryStyle")) as
      | "premium"
      | "classic"
      | null;
    if (saved === "premium" || saved === "classic") setStyle(saved);
  }, []);
  const updateStyle = (s: "premium" | "classic") => {
    setStyle(s);
    try { localStorage.setItem("sj.categoryStyle", s); } catch {}
  };
  const newArrivals = data?.products.slice(0, 10) ?? [];
  const categories = data?.categories ?? [];
  const counts = data?.counts ?? new Map<string, number>();

  return (
    <MobileShell>
      <h1 className="sr-only">Sparkling Silver — Wholesale Jewellery Catalogue</h1>

      <VideoShowcase />
      <AccessBanner />

      {/* NEW ARRIVAL — admin-curated */}
      {newArrivals.length > 0 && (
        <section className="pt-6">
          <SectionHeader title="New Arrival" to="/catalogue" />
          <div className="mt-3 flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
            {newArrivals.map((p) => (
              <div key={p.id} className="w-[170px] shrink-0">
                <CatalogueCard p={p} showCart={false} compact />
              </div>
            ))}
          </div>
        </section>
      )}




      {/* OUR COLLECTION — 3-col photo grid */}
      <section className="pt-6">
        <div className="flex items-center justify-between gap-2 px-3">
          <div className="flex-1">
            <SectionHeader title="Our Collection" to="/catalogue" />
          </div>
        </div>
        <div className="mt-2 flex justify-end px-3">
          <div className="inline-flex rounded-[2px] border border-teal/40 p-[2px] text-[11px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => updateStyle("premium")}
              aria-pressed={style === "premium"}
              className={`px-3 py-1 rounded-[2px] transition-colors ${style === "premium" ? "bg-teal text-white" : "text-teal hover:bg-teal/10"}`}
            >
              Premium
            </button>
            <button
              type="button"
              onClick={() => updateStyle("classic")}
              aria-pressed={style === "classic"}
              className={`px-3 py-1 rounded-[2px] transition-colors ${style === "classic" ? "bg-teal text-white" : "text-teal hover:bg-teal/10"}`}
            >
              Classic
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 px-3 lg:grid lg:grid-cols-2 lg:gap-6">
          {categories.map((c, i) => {
            const count = counts.get(c.id) ?? 0;
            const dbImage = (c as unknown as { image_url?: string | null }).image_url;
            const premium = PREMIUM_CATEGORY_IMAGES[c.slug];
            const classic = resolveProductImage(c.slug === "jewelry-sets" ? "cat-necklaces-a.jpg" : `cat-${c.slug}-a.jpg`);
            const image = style === "premium" ? (premium || dbImage || classic) : (classic || dbImage || premium);
            return (
              <CategoryTile
                key={c.id}
                slug={c.slug}
                name={c.name}
                image={image}
                count={count}
                newCount={Math.max(0, Math.min(count, 24))}
                priority={i < 3}
              />
            );
          })}
        </div>
      </section>

      <div className="h-8" />
    </MobileShell>
  );
}
