import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { GoldRateStrip } from "@/components/GoldRateStrip";
import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { HeroSlider } from "@/components/HeroSlider";
import { AccessBanner } from "@/components/AccessBanner";
import { CategoryTile } from "@/components/CategoryTile";
import { resolveProductImage } from "@/lib/product-images";
import heroBridal from "@/assets/hero-bridal.jpg";
import heroFestive from "@/assets/hero-festive.jpg";
import heroDaily from "@/assets/hero-daily.jpg";

const homeQuery = queryOptions({
  queryKey: ["home"],
  staleTime: 60_000,
  queryFn: async () => {
    const [categories, products, allCounts] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").or("is_new.eq.true,is_bestseller.eq.true").limit(24),
      supabase.from("products").select("category_id"),
    ]);
    const counts = new Map<string, number>();
    for (const row of (allCounts.data ?? []) as { category_id: string | null }[]) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    return {
      categories: categories.data ?? [],
      products: (products.data ?? []) as CatalogueCardData[],
      counts,
      total: allCounts.data?.length ?? 0,
    };
  },
});

const HOME_TITLE = "Sparkling Silver LLP — Premium Indian Jewellery";
const HOME_DESC = "Wholesale jewellery catalogue — 22K & 18K gold, diamond and gemstone designs across rings, earrings, pendants, bangles and more.";

const CATEGORY_UNSPLASH: Record<string, string> = {
  rings: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&fit=crop",
  necklaces: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&fit=crop",
  earrings: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&fit=crop",
  bangles: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&fit=crop",
  bracelets: "https://images.unsplash.com/photo-1573408301185-9519f94815b6?w=400&fit=crop",
  pendants: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=400&fit=crop",
  chains: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&fit=crop",
  mangalsutra: "https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?w=400&fit=crop",
  anklets: "https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?w=400&fit=crop",
  kada: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&fit=crop",
  "jewelry-sets": "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&fit=crop",
};

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
      { rel: "preload", as: "image", href: heroBridal, fetchpriority: "high" } as unknown as { rel: string; href: string },
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
  const newArrivals = (data.products.filter((p) => (p as unknown as { is_new?: boolean }).is_new).slice(0, 10).length
    ? data.products.filter((p) => (p as unknown as { is_new?: boolean }).is_new)
    : data.products
  ).slice(0, 10);

  return (
    <MobileShell>
      <h1 className="sr-only">Sparkling Silver LLP — Wholesale Jewellery Catalogue</h1>
      <GoldRateStrip />
      <HeroSlider slides={heroSlides} />
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
        <SectionHeader title="Our Collection" to="/catalogue" />
        <div className="mt-3 grid grid-cols-3 gap-[2px]">
          {data.categories.map((c) => {
            const count = data.counts.get(c.id) ?? 0;
            return (
              <CategoryTile
                key={c.id}
                slug={c.slug}
                name={c.name}
                image={
                  (c as unknown as { image_url?: string | null }).image_url ||
                  CATEGORY_UNSPLASH[c.slug] ||
                  resolveProductImage(c.slug === "jewelry-sets" ? "cat-necklaces-a.jpg" : `cat-${c.slug}-a.jpg`)
                }
                count={count}
                newCount={Math.max(0, Math.min(count, 24))}
              />
            );
          })}
        </div>
      </section>

      <div className="h-8" />
    </MobileShell>
  );
}
