import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowUpDown, Filter as FilterIcon, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";

const catalogQuery = queryOptions({
  queryKey: ["catalogue"],
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  queryFn: async () => {
    const [products, categories] = await Promise.all([
      supabase.from("products").select("*").limit(120),
      supabase.from("categories").select("*").in("slug", ["antique", "cz"]).order("sort_order"),
    ]);
    return {
      products: (products.data ?? []) as (CatalogueCardData & { category_id: string })[],
      categories: categories.data ?? [],
    };
  },
});

const CAT_TITLE = "Shop 925 Sterling Silver Jewellery — Sparkling Silver";
const CAT_DESC = "Browse our complete wholesale silver jewellery catalogue. Filter by category, purity and weight.";

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: CAT_TITLE },
      { name: "description", content: CAT_DESC },
      { property: "og:title", content: CAT_TITLE },
      { property: "og:description", content: CAT_DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/catalogue" },
    ],
    links: [{ rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/catalogue" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Catalogue,
});

function Catalogue() {
  const { data } = useSuspenseQuery(catalogQuery);
  const whatsAppHref = whatsappUrl("Hi, I'd like full catalogue access.");
  const [sort, setSort] = useState("newest");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [purities, setPurities] = useState<string[]>([]);
  
  const [view, setView] = useState<"grid2" | "grid1">("grid2");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const products = useMemo(() => {
    let list = data.products;
    if (categoryIds.length) list = list.filter((p) => p.category_id && categoryIds.includes(p.category_id));
    if (purities.length) list = list.filter((p) => purities.includes((p as unknown as { purity: string }).purity));
    switch (sort) {
      case "weight-desc": list = [...list].sort((a, b) => Number(b.gross_weight) - Number(a.gross_weight)); break;
      case "weight-asc": list = [...list].sort((a, b) => Number(a.gross_weight) - Number(b.gross_weight)); break;
    }
    return list;
  }, [data.products, categoryIds, purities, sort]);

  return (
    <MobileShell title="Catalogue">
      <div className="px-3 pt-4">
        <h1 className="text-[16px] font-bold text-[#1A1A1A]">Catalogue ({products.length})</h1>
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
      </div>

      {/* Sticky banner */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-[#E5E5E5] bg-white px-3 py-2.5" style={{ paddingBottom: 10 }}>
        <div className="mx-auto flex max-w-2xl lg:max-w-[1600px] lg:px-6 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">Want our entire range?</p>
            <p className="truncate text-[10.5px] text-[#666]">Call / WhatsApp us now</p>
          </div>
          <a
            href={whatsAppHref}
            target={WHATSAPP_LINK_TARGET}
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              openWhatsAppUrl(whatsAppHref);
            }}
            className="rounded-[2px] bg-teal-dark px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-teal"
          >
            Ask for Access
          </a>
        </div>
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
                {data.categories.map((c) => (
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
