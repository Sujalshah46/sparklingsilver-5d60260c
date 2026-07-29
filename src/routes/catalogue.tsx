import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSuspenseInfiniteQuery, infiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { CategoryTile } from "@/components/CategoryTile";
import { PREMIUM_CATEGORY_IMAGES, resolveProductImage } from "@/lib/product-images";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { ArrowUpDown, Filter as FilterIcon, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

const searchSchema = z.object({
  new: fallback(z.boolean(), false).default(false),
});

type CatalogProduct = CatalogueCardData & { category_id: string; homepage_featured?: boolean | null };

const PAGE_SIZE = 30;

async function fetchVisibleCategories() {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .in("slug", ["antique", "cz"])
    .order("sort_order");
  return data ?? [];
}

const catalogInfiniteQuery = (onlyNew: boolean) =>
  infiniteQueryOptions({
    queryKey: ["catalogue-infinite", onlyNew ? "new" : "all"],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const categories = await fetchVisibleCategories();
      const visibleIds = categories.map((c) => c.id);
      let qb = supabase
        .from("products")
        .select("*", { count: "exact" })
        .in("category_id", visibleIds);
      if (onlyNew) {
        qb = qb.eq("homepage_featured", true).order("homepage_featured_order", { ascending: true });
      } else {
        qb = qb.order("created_at", { ascending: false });
      }
      const { data, count } = await qb.range(from, to);
      return {
        products: (data ?? []) as CatalogProduct[],
        categories,
        total: count ?? 0,
        page: pageParam as number,
      };
    },
    getNextPageParam: (last) => {
      const loaded = (last.page + 1) * PAGE_SIZE;
      return loaded < last.total ? last.page + 1 : undefined;
    },
  });

const CAT_TITLE = pageTitle("Shop 925 Sterling Silver Jewellery");
const CAT_DESC = pageDescription(
  "Browse our complete wholesale silver jewellery catalogue. Filter by category, purity and weight.",
);
const NEW_TITLE = pageTitle("New Arrivals");
const NEW_DESC = pageDescription(
  "Discover the latest wholesale silver jewellery arrivals hand-picked by Sparkling Silver.",
);

export const Route = createFileRoute("/catalogue")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: CAT_TITLE },
      ...descriptionTags(CAT_DESC),
      { property: "og:title", content: CAT_TITLE },
      { property: "og:url", content: "https://sparklingsilver.in/catalogue" },
    ],
    links: [{ rel: "canonical", href: "https://sparklingsilver.in/catalogue" }],
  }),
  loader: ({ context }) => context.queryClient.ensureInfiniteQueryData(catalogInfiniteQuery(false)),
  component: Catalogue,
});

function Catalogue() {
  const { new: onlyNew } = useSearch({ from: "/catalogue" });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(catalogInfiniteQuery(onlyNew));

  const allProducts = useMemo(
    () => data.pages.flatMap((p) => p.products),
    [data.pages],
  );
  const total = data.pages[0]?.total ?? allProducts.length;
  const categories = data.pages[0]?.categories ?? [];

  const [sort, setSort] = useState("newest");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [purities, setPurities] = useState<string[]>([]);
  const [view, setView] = useState<"grid2" | "grid1">("grid2");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const products = useMemo(() => {
    let list = allProducts;
    if (categoryIds.length) list = list.filter((p) => p.category_id && categoryIds.includes(p.category_id));
    if (purities.length) list = list.filter((p) => purities.includes((p as unknown as { purity: string }).purity));
    switch (sort) {
      case "weight-desc": list = [...list].sort((a, b) => Number(b.gross_weight) - Number(a.gross_weight)); break;
      case "weight-asc": list = [...list].sort((a, b) => Number(a.gross_weight) - Number(b.gross_weight)); break;
    }
    return list;
  }, [allProducts, categoryIds, purities, sort]);

  // Infinite-scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Per-category design counts for the collection tiles
  const { data: catCounts } = useQuery({
    queryKey: ["catalogue-category-counts"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        categories.map(async (c) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("category_id", c.id as string);
          return [c.id as string, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    enabled: categories.length > 0,
  });

  // Collections-only view for /catalogue (no product grid)
  if (!onlyNew) {
    return (
      <MobileShell title="Catalogue">
        <section className="px-3 py-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A]">Our Collections</p>
          <span className="mt-1 block h-px w-8 bg-teal" />
          <div className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-6">
            {categories.map((c, i) => (
              <CategoryTile
                key={c.id}
                slug={c.slug}
                name={c.name}
                image={
                  PREMIUM_CATEGORY_IMAGES[c.slug] ||
                  (c as unknown as { image_url?: string | null }).image_url ||
                  resolveProductImage(`cat-${c.slug}-a.jpg`)
                }
                count={catCounts?.[c.id as string] ?? 0}
                priority={i < 2}
              />
            ))}
          </div>
        </section>
        <div className="h-24" />
      </MobileShell>
    );
  }

  return (
    <MobileShell title={onlyNew ? "New Arrivals" : "Catalogue"}>
      {!onlyNew && categories.length > 0 && (
        <section className="px-3 pt-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A]">Our Collections</p>
          <span className="mt-1 block h-px w-8 bg-teal" />
          <div className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-6">
            {categories.map((c, i) => (
              <CategoryTile
                key={c.id}
                slug={c.slug}
                name={c.name}
                image={
                  PREMIUM_CATEGORY_IMAGES[c.slug] ||
                  (c as unknown as { image_url?: string | null }).image_url ||
                  resolveProductImage(`cat-${c.slug}-a.jpg`)
                }
                count={catCounts?.[c.id as string] ?? 0}
                priority={i < 2}
              />
            ))}
          </div>
        </section>
      )}

      <div className="px-3 pt-4">
        <h1 className="text-[16px] font-bold text-[#1A1A1A]">

          {onlyNew ? "New Arrivals" : "Catalogue"} ({products.length}
          {allProducts.length < total ? ` of ${total}` : ""})
          {onlyNew && (
            <span className="ml-2 inline-block rounded-[2px] bg-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Featured
            </span>
          )}
        </h1>
      </div>

      {/* Sort | Filter | View Style bar */}
      <div className="sticky top-[52px] z-20 mt-3 grid grid-cols-3 border-y border-[#E5E5E5] bg-white text-[12px] font-semibold uppercase tracking-wider text-[#333]">
        <button onClick={() => setSortOpen(true)} className="flex items-center justify-center gap-1.5 border-r border-[#E5E5E5] py-3 hover:bg-[#F8F8F8]">
          <ArrowUpDown className="h-3.5 w-3.5" /> Sort
        </button>
        <button onClick={() => setFilterOpen(true)} className="flex items-center justify-center gap-1.5 border-r border-[#E5E5E5] py-3 hover:bg-[#F8F8F8]">
          <FilterIcon className="h-3.5 w-3.5" /> Filter
          {(categoryIds.length + purities.length) > 0 && (
            <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] text-white">{categoryIds.length + purities.length}</span>
          )}
        </button>
        <button onClick={() => setView(view === "grid2" ? "grid1" : "grid2")} className="flex items-center justify-center gap-1.5 py-3 hover:bg-[#F8F8F8]">
          <LayoutGrid className="h-3.5 w-3.5" /> View
        </button>
      </div>

      <div className="px-2 py-3">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-lg text-[#1A1A1A]">No products match those filters</p>
            <p className="mt-1 text-sm text-[#888]">Try widening your search.</p>
          </div>
        ) : (
          <div className={view === "grid2" ? "grid grid-cols-2 gap-[2px] md:grid-cols-3 md:gap-2 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6" : "grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3"}>
            {products.map((p, i) => (
              <CatalogueCard key={p.id} p={p as unknown as CatalogueCardData} priority={i < 4} />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel + loader */}
        {hasNextPage && (
          <div ref={sentinelRef} className="py-8 text-center text-[12px] text-[#888]">
            {isFetchingNextPage ? "Loading more…" : "Scroll for more"}
          </div>
        )}
        {!hasNextPage && allProducts.length > PAGE_SIZE && (
          <div className="py-6 text-center text-[11px] uppercase tracking-wider text-[#999]">
            End of catalogue
          </div>
        )}
      </div>


      {/* Floating advance filter */}
      <button
        onClick={() => setFilterOpen(true)}
        className="fixed bottom-32 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-teal px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg hover:bg-teal-dark"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Advance Filter
      </button>

      {/* Sort sheet */}
      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetTrigger className="hidden" />
        <SheetContent side="bottom" className="rounded-t-md">
          <SheetHeader><SheetTitle>Sort By</SheetTitle></SheetHeader>
          <div className="grid gap-1 py-2">
            {[
              { v: "newest", l: "Newest" },
              { v: "weight-desc", l: "Weight: High → Low" },
              { v: "weight-asc", l: "Weight: Low → High" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => { setSort(o.v); setSortOpen(false); }}
                className={`flex items-center justify-between rounded-[2px] px-3 py-3 text-sm ${sort === o.v ? "bg-teal-soft text-[#1A1A1A]" : "hover:bg-[#F4F4F4]"}`}
              >
                {o.l}
                {sort === o.v && <span className="text-teal">✓</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-auto rounded-t-md">
          <SheetHeader><SheetTitle>Filter</SheetTitle></SheetHeader>
          <div className="space-y-6 py-4">
            <div>
              <Label className="font-semibold">Category</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={categoryIds.includes(c.id)}
                      onCheckedChange={(v) => setCategoryIds(v ? [...categoryIds, c.id] : categoryIds.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="font-semibold">Silver Purity</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["925", "999", "800"].map((p) => {
                  const active = purities.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setPurities(active ? purities.filter((x) => x !== p) : [...purities, p])}
                      className={`rounded-[2px] border px-3 py-1.5 text-sm ${active ? "border-teal bg-teal text-white" : "border-[#CCC] text-[#333]"}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <SheetFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-[2px]" onClick={() => { setCategoryIds([]); setPurities([]); }}>Reset</Button>
            <Button className="flex-1 rounded-[2px] bg-teal hover:bg-teal-dark" onClick={() => setFilterOpen(false)}>Apply</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="h-24" />
    </MobileShell>
  );
}
