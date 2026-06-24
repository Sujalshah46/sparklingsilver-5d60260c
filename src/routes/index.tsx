import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { GoldRateStrip } from "@/components/GoldRateStrip";

import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import heroBridal from "@/assets/hero-bridal.jpg";
import heroFestive from "@/assets/hero-festive.jpg";
import heroDaily from "@/assets/hero-daily.jpg";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [categories, products, collections] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*"),
      supabase.from("collections").select("*").order("sort_order"),
    ]);
    return {
      categories: categories.data ?? [],
      products: (products.data ?? []) as ProductCardData[],
      collections: collections.data ?? [],
    };
  },
});

const HOME_TITLE = "Sparkling Jewellers LLP — Premium Indian Jewellery";
const HOME_DESC = "Shop 22K & 18K gold, diamond and gemstone jewellery — bridal, daily wear and festive designs with transparent pricing and BIS hallmark.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: "https://cuddly-code-gen.lovable.app/" },
      { property: "og:image", content: "https://cuddly-code-gen.lovable.app/og-home.jpg" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [
      { rel: "canonical", href: "https://cuddly-code-gen.lovable.app/" },
      { rel: "preload", as: "image", href: heroBridal, fetchpriority: "high" } as unknown as { rel: string; href: string },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "JewelryStore",
          name: "Sparkling Jewellers LLP",
          url: "https://cuddly-code-gen.lovable.app",
          image: "https://cuddly-code-gen.lovable.app/og-home.jpg",
          telephone: "+91-99999-99999",
          email: "hello@sparklingjewellers.in",
          address: {
            "@type": "PostalAddress",
            streetAddress: "123 Jewellers Lane, Zaveri Bazaar",
            addressLocality: "Mumbai",
            postalCode: "400001",
            addressRegion: "MH",
            addressCountry: "IN",
          },
          openingHours: "Mo-Sa 10:30-20:30",
          priceRange: "₹₹₹",
        }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

const heroes = [
  { src: heroBridal, title: "Bridal Collection", sub: "Heirloom-worthy pieces, hand-crafted with love", to: "/category/necklaces" },
  { src: heroFestive, title: "Festive Edit", sub: "Celebrate every occasion in golden splendour", to: "/category/bangles" },
  { src: heroDaily, title: "Daily Wear", sub: "Light. Elegant. Effortlessly you.", to: "/category/chains" },
];

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  const newArrivals = data.products.filter((p) => p.is_new).slice(0, 8);
  const bestsellers = data.products.filter((p) => p.is_bestseller).slice(0, 6);
  const trending = data.products.slice(0, 8);

  return (
    <MobileShell>
      <GoldRateStrip />
      <h1 className="sr-only">Sparkling Jewellers — Premium Indian Gold & Diamond Jewellery</h1>

      {/* Hero carousel */}
      <section className="px-4 pt-4">
        <Carousel opts={{ loop: true }} className="overflow-hidden rounded-2xl">
          <CarouselContent>
            {heroes.map((h) => (
              <CarouselItem key={h.title}>
                <Link to={h.to} className="relative block aspect-[4/3] sm:aspect-[16/9]">
                  <img src={h.src} alt={h.title} loading="eager" width={1280} height={768} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-ivory">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] gold-text">Sparkling</p>
                    <h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">{h.title}</h2>
                    <p className="mt-1 text-sm opacity-90">{h.sub}</p>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>

      {/* Categories */}
      <section className="px-4 py-6">
        <SectionHeading title="Shop by Category" to="/catalogue" />
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {data.categories.map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <div className="grid h-16 w-16 place-items-center rounded-full border border-gold/40 bg-card font-serif text-base font-semibold text-burgundy transition group-hover:bg-gold/10">
                {c.name.charAt(0)}
              </div>
              <span className="line-clamp-1 text-[11px] font-medium text-foreground">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-4">
        <div className="px-4">
          <SectionHeading title="New Arrivals" to="/catalogue" />
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {newArrivals.map((p) => (
            <div key={p.id} className="w-44 shrink-0">
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      </section>

      {/* Collections */}
      <section className="px-4 py-4">
        <SectionHeading title="Featured Collections" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {data.collections.map((col, idx) => (
            <div
              key={col.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
            >
              <img
                src={[heroBridal, heroDaily, heroFestive, heroBridal][idx % 4]}
                alt={col.name}
                loading="lazy"
                width={400}
                height={400}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-ivory">
                <h3 className="font-serif text-base font-semibold">{col.name}</h3>
                <p className="line-clamp-1 text-[11px] opacity-80">{col.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section className="px-4 py-4">
        <SectionHeading title="Best Sellers" to="/catalogue" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {bestsellers.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="py-4">
        <div className="px-4">
          <SectionHeading title="Trending Designs" to="/catalogue" />
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {trending.map((p) => (
            <div key={p.id} className="w-44 shrink-0">
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      </section>

      {/* Footer banner */}
      <section className="mx-4 mt-6 mb-10 overflow-hidden rounded-2xl bg-burgundy p-6 text-ivory">
        <h3 className="font-serif text-xl font-semibold">Visit Our Store</h3>
        <p className="mt-2 text-sm opacity-90">Experience the craftsmanship in person. Our master jewellers are here to help.</p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span>123 Jewellers Lane, Mumbai 400001</span></div>
          <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span>+91 99999 99999</span></div>
        </div>
        <Link to="/contact" className="mt-4 inline-flex items-center gap-1 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-charcoal">
          Get in Touch <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      
    </MobileShell>
  );
}

function SectionHeading({ title, to }: { title: string; to?: string }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center gap-0.5 text-xs font-medium text-burgundy">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
