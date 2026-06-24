import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";

const catalogQuery = queryOptions({
  queryKey: ["catalogue"],
  queryFn: async () => {
    const [products, categories] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    return { products: (products.data ?? []) as ProductCardData[] & { category_id: string; purity: string; price: number }[], categories: categories.data ?? [] };
  },
});

const CAT_TITLE = "Shop Gold & Diamond Jewellery — Sparkling Jewellers";
const CAT_DESC = "Browse our complete collection of 22K & 18K gold and diamond jewellery. Filter by category, purity and price.";

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: CAT_TITLE },
      { name: "description", content: CAT_DESC },
      { property: "og:title", content: CAT_TITLE },
      { property: "og:description", content: CAT_DESC },
      { property: "og:url", content: "https://cuddly-code-gen.lovable.app/catalogue" },
    ],
    links: [{ rel: "canonical", href: "https://cuddly-code-gen.lovable.app/catalogue" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Catalogue,
});

type RawProduct = Awaited<ReturnType<typeof getRow>>;
type Row = RawProduct;
async function getRow() {
  const r = await supabase.from("products").select("*").limit(1).single();
  return r.data!;
}

function Catalogue() {
  const { data } = useSuspenseQuery(catalogQuery);
  const [sort, setSort] = useState("newest");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [purities, setPurities] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(300000);
  const navigate = useNavigate();

  const products = useMemo(() => {
    let list = data.products as unknown as Row[];
    if (categoryIds.length) list = list.filter((p) => p.category_id && categoryIds.includes(p.category_id));
    if (purities.length) list = list.filter((p) => purities.includes(p.purity));
    list = list.filter((p) => Number(p.price) <= maxPrice);
    switch (sort) {
      case "price-asc": list = [...list].sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price-desc": list = [...list].sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "weight": list = [...list].sort((a, b) => Number((b as { net_weight: number }).net_weight) - Number((a as { net_weight: number }).net_weight)); break;
    }
    return list;
  }, [data.products, categoryIds, purities, maxPrice, sort]);

  return (
    <MobileShell title="Shop">
      <h1 className="px-4 pt-4 font-serif text-2xl font-bold text-foreground">Shop Our Jewellery Collection</h1>
      <p className="px-4 pt-1 text-sm text-muted-foreground">Filter by category, purity and price.</p>
      <div className="sticky top-[57px] z-20 mt-4 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price: Low → High</SelectItem>
            <SelectItem value="price-desc">Price: High → Low</SelectItem>
            <SelectItem value="weight">Weight</SelectItem>
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filters
              {(categoryIds.length + purities.length) > 0 && (
                <span className="ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-burgundy px-1 text-[10px] text-ivory">{categoryIds.length + purities.length}</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-auto rounded-t-2xl">
            <SheetHeader><SheetTitle className="font-serif">Filter</SheetTitle></SheetHeader>
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
                <Label className="font-semibold">Purity</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["18K", "22K", "24K"].map((p) => (
                    <label key={p} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                      <Checkbox checked={purities.includes(p)} onCheckedChange={(v) => setPurities(v ? [...purities, p] : purities.filter((x) => x !== p))} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="font-semibold">Max Price: ₹{maxPrice.toLocaleString("en-IN")}</Label>
                <Slider value={[maxPrice]} onValueChange={(v) => setMaxPrice(v[0])} min={10000} max={300000} step={5000} className="mt-3" />
              </div>
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCategoryIds([]); setPurities([]); setMaxPrice(300000); }}>Reset</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="px-3 py-4">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-lg text-foreground">No products match those filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try widening your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} p={p as unknown as ProductCardData} />
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
