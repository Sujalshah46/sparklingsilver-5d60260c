import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";

import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { HeroSlider } from "@/components/HeroSlider";
import { AccessBanner } from "@/components/AccessBanner";
import { CategoryTile } from "@/components/CategoryTile";
import { VideoShowcase } from "@/components/VideoShowcase";
import { resolveProductImage, PREMIUM_CATEGORY_IMAGES } from "@/lib/product-images";
import heroBridal from "@/assets/hero-bridal.jpg";
import heroFestive from "@/assets/hero-festive.jpg";
import heroDaily from "@/assets/hero-daily.jpg";

const homeQuery = queryOptions({
  queryKey: ["home"],
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  queryFn: async () => {
    const [categories, products, allProducts, totalRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").or("is_new.eq.true,is_bestseller.eq.true").limit(24),
      supabase.from("products").select("category_id"),
      supabase.from("products").select("*", { count: "exact", head: true }),
    ]);
    const counts = new Map<string, number>();
    for (const row of (allProducts.data ?? []) as { category_id: string | null }[]) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    return {
      categories: categories.data ?? [],
      products: (products.data ?? []) as CatalogueCardData[],
      counts,
      total: totalRes.count ?? 0,
    };
  },
});

const HOME_TITLE = "Sparkling Silver LLP — Premium Indian Jewellery";
const HOME_DESC = "Wholesale 925 sterling silver jewellery catalogue — premium silver designs across rings, earrings, pendants, bangles, anklets and more.";

const CATEGORY_UNSPLASH = PREMIUM_CATEGORY_IMAGES;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/" },
      { property: "og:image", content: "https://sparkling-jewellers-llp.lovable.app/og-home.jpg" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [
      { rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/" },
      { rel: "preload", as: "image", href: heroBridal, fetchPriority: "high" } as unknown as { rel: string; href: string },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JewelryStore",
          name: "Sparkling Silver LLP",
          url: "https://sparkling-jewellers-llp.lovable.app",
          image: "https://sparkling-jewellers-llp.lovable.app/og-home.jpg",
          telephone: "+91-99999-99999",
        }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

const heroSlides = [
  { src: heroBridal, collection: "Vibrant", to: "/category/necklaces" },
  { src: heroFestive, collection: "Heritage", to: "/category/bangles" },
  { src: heroDaily, collection: "Everyday", to: "/category/chains" },
];

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
  const { data } = useSuspenseQuery(homeQuery);
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
  const newArrivals = (data.products.filter((p) => (p as unknown as { is_new?: boolean }).is_new).slice(0, 10).length
    ? data.products.filter((p) => (p as unknown as { is_new?: boolean }).is_new)
    : data.products
  ).slice(0, 10);

  return (
    <MobileShell>
      <h1 className="sr-only">Sparkling Silver LLP — Wholesale Jewellery Catalogue</h1>
      
      <VideoShowcase />
      <AccessBanner />

      {/* NEW ARRIVAL */}
      <section className="pt-6">
        <SectionHeader title="New Arrival" total={data.total} to="/catalogue" />
        <div className="mt-3 flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
          {newArrivals.map((p) => (
            <div key={p.id} className="w-[170px] shrink-0">
              <CatalogueCard p={p} showCart={false} compact />
            </div>
          ))}
        </div>
      </section>




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
        <div className="mt-3 flex flex-col gap-3 px-3">
          {data.categories.map((c, i) => {
            const count = data.counts.get(c.id) ?? 0;
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
