import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, X } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Jewellery — Sparkling Jewellers" },
      { name: "description", content: "Search jewellery designs by name, SKU or category." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SearchPage,
});

const POPULAR = ["Bridal necklace", "Diamond ring", "Gold chain", "Kada", "Mangalsutra"];

function SearchPage() {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("recent-search") : null;
    if (raw) setRecent(JSON.parse(raw));
  }, []);

  const { data } = useQuery({
    queryKey: ["search", q],
    enabled: q.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);
      return (data ?? []) as ProductCardData[];
    },
  });

  const commit = (term: string) => {
    if (!term) return;
    const next = [term, ...recent.filter((x) => x !== term)].slice(0, 5);
    setRecent(next);
    if (typeof window !== "undefined") localStorage.setItem("recent-search", JSON.stringify(next));
  };

  return (
    <MobileShell title="Search">
      <div className="sticky top-[57px] z-20 border-b border-border bg-background px-4 py-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => commit(q)}
            placeholder="Search by name, SKU, category…"
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {q.length <= 1 ? (
          <div className="space-y-6">
            {recent.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button key={r} onClick={() => setQ(r)} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                      {r}
                      <X className="h-3 w-3" onClick={(e) => { e.stopPropagation(); const n = recent.filter((x) => x !== r); setRecent(n); localStorage.setItem("recent-search", JSON.stringify(n)); }} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR.map((p) => (
                  <button key={p} onClick={() => setQ(p)} className="rounded-full border border-gold/40 bg-card px-3 py-1.5 text-sm hover:bg-gold/10">{p}</button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">{data?.length ?? 0} results for "{q}"</p>
            <div className="grid grid-cols-2 gap-3">
              {(data ?? []).map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
            {data && data.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No matches. Try a different term.</p>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
