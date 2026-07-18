import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUp, ArrowDown, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { setHomepageFeatured, reorderHomepageFeatured, clearHomepageFeatured } from "@/lib/homepage-featured.functions";
import { getErrorMessage } from "@/lib/errors";
import { categoryPlaceholder, resolveProductImage, productThumbUrl } from "@/lib/product-images";

export const Route = createFileRoute("/_authenticated/admin/homepage-featured")({
  head: () => ({ meta: [{ title: "Admin — Homepage New Arrival" }] }),
  component: HomepageFeaturedAdmin,
});

const MAX = 10;

function HomepageFeaturedAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(false);
  const setFeatured = useServerFn(setHomepageFeatured);
  const reorder = useServerFn(reorderHomepageFeatured);
  const clearAll = useServerFn(clearHomepageFeatured);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-hpf-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, image_url, gross_weight, purity, homepage_featured, homepage_featured_order")
        .eq("import_status", "active")
        .order("sku", { ascending: true });
      return data ?? [];
    },
  });

  const featured = useMemo(
    () =>
      [...products]
        .filter((p) => p.homepage_featured)
        .sort((a, b) => (a.homepage_featured_order ?? 0) - (b.homepage_featured_order ?? 0)),
    [products],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s),
    );
  }, [products, q]);

  const selectedCount = featured.length;
  const atCap = selectedCount >= MAX;

  async function toggle(id: string, next: boolean) {
    if (next && atCap) {
      toast.error(`You've selected ${MAX}/${MAX} SKUs. Uncheck one to add another.`);
      return;
    }
    try {
      await setFeatured({ data: { id, featured: next } });
      qc.invalidateQueries({ queryKey: ["admin-hpf-products"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= featured.length) return;
    const ids = featured.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorder({ data: { orderedIds: ids } });
      qc.invalidateQueries({ queryKey: ["admin-hpf-products"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleClearAll() {
    if (!confirm("Remove all featured selections?")) return;
    try {
      await clearAll({});
      qc.invalidateQueries({ queryKey: ["admin-hpf-products"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <MobileShell title="Homepage New Arrival">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold">Homepage New Arrival</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              Selected: <span className="font-serif font-semibold">{selectedCount} / {MAX}</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreview(true)} disabled={selectedCount === 0}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearAll} disabled={selectedCount === 0}>
                Clear All
              </Button>
            </div>
          </div>
          {atCap && (
            <p className="mt-2 text-[11px] text-amber-800">
              You've selected {MAX}/{MAX} SKUs. Uncheck one to add another.
            </p>
          )}
        </div>

        {/* Selected list (reorder) */}
        {featured.length > 0 && (
          <section>
            <h2 className="mb-2 font-serif text-sm font-semibold">Selected order</h2>
            <ul className="space-y-2">
              {featured.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-burgundy text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <img
                    src={resolveProductImage(p.image_url, categoryPlaceholder)}
                    alt={p.name}
                    className="h-10 w-10 rounded-md bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.sku}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md border border-border p-1 disabled:opacity-30 hover:border-gold"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === featured.length - 1}
                      className="rounded-md border border-border p-1 disabled:opacity-30 hover:border-gold"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggle(p.id, false)}
                      className="rounded-md border border-destructive/30 p-1 text-destructive hover:bg-destructive/5"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Product picker */}
        <section>
          <h2 className="mb-2 font-serif text-sm font-semibold">All SKUs</h2>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="pl-9" />
          </div>
          <ul className="space-y-2">
            {filtered.map((p) => {
              const checked = !!p.homepage_featured;
              const disabled = !checked && atCap;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-burgundy disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <img
                    src={resolveProductImage(p.image_url, categoryPlaceholder)}
                    alt={p.name}
                    loading="lazy"
                    className="h-12 w-12 rounded-md bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.sku} · {Number(p.gross_weight ?? 0).toFixed(3)} g · {p.purity ?? "—"}
                    </p>
                  </div>
                  {checked && <Badge variant="outline">Featured</Badge>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setPreview(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">Homepage carousel preview</h3>
              <button onClick={() => setPreview(false)} className="rounded-md border border-border p-1"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {featured.map((p) => (
                <div key={p.id} className="w-[170px] shrink-0 rounded-lg border border-border p-2">
                  <img
                    src={resolveProductImage(p.image_url, categoryPlaceholder)}
                    alt={p.name}
                    className="aspect-square w-full rounded-md bg-secondary object-cover"
                  />
                  <p className="mt-1 truncate text-xs font-medium">{p.sku}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {Number(p.gross_weight ?? 0).toFixed(3)} g · {p.purity}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
