import { pageTitle } from "@/lib/seo";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Trash2, AlertTriangle, PackageX } from "lucide-react";
import { toast } from "sonner";

import { deleteProduct } from "@/lib/products.functions";
import { setProductFlag } from "@/lib/homepage-featured.functions";
import { getErrorMessage } from "@/lib/errors";
import { categoryPlaceholder, resolveProductImage, productThumbUrl } from "@/lib/product-images";

export const Route = createLazyFileRoute("/_authenticated/admin/products/")({
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const del = useServerFn(deleteProduct);
  const toggleFlag = useServerFn(setProductFlag);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, slug, image_url, stock_quantity, low_stock_threshold, is_new, is_bestseller, gross_weight, categories(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products ?? [];
    return (products ?? []).filter(
      (p: any) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s),
    );
  }, [products, q]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await del({ data: { id } });
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleFlag(id: string, field: "is_new" | "is_bestseller", value: boolean) {
    try {
      await toggleFlag({ data: { id, field, value } });
      qc.setQueryData(["admin-products"], (prev: any) =>
        (prev ?? []).map((p: any) => (p.id === id ? { ...p, [field]: value } : p)),
      );
      qc.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  const newCount = (products ?? []).filter((p: any) => p.is_new).length;
  const bestCount = (products ?? []).filter((p: any) => p.is_bestseller).length;

  return (
    <MobileShell title="Products">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold">Products</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        <Link
          to="/admin/products/$id"
          params={{ id: "new" }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-burgundy px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add product
        </Link>

        <Link
          to="/admin/homepage-featured"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-burgundy px-3 py-2 text-sm font-medium text-burgundy hover:bg-burgundy/5"
        >
          Manage Homepage New Arrival section
        </Link>

        <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{newCount}</span> SKUs tagged New Arrival ·{" "}
          <span className="font-semibold text-foreground">{bestCount}</span> SKUs tagged Bestseller
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p: any) => {
              const qty = p.stock_quantity ?? 0;
              const thr = p.low_stock_threshold ?? 0;
              const out = qty === 0;
              const low = !out && qty <= thr;
              return (
                <li key={p.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={productThumbUrl(resolveProductImage(p.image_url, categoryPlaceholder), { width: 128, quality: 55 })}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback === "1") { img.style.visibility = "hidden"; return; }
                        img.dataset.fallback = "1";
                        img.src = categoryPlaceholder;
                      }}
                      className="h-16 w-16 rounded-lg bg-secondary object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.sku} · {p.categories?.name ?? "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#555]">Gross: {Number(p.gross_weight ?? 0).toFixed(3)} g</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {out && <Badge className="bg-destructive/15 text-destructive"><PackageX className="mr-1 h-3 w-3" />Out</Badge>}
                        {low && <Badge className="bg-amber-100 text-amber-900"><AlertTriangle className="mr-1 h-3 w-3" />Low ({qty})</Badge>}
                        {!out && !low && <Badge className="bg-green-100 text-green-900">Stock {qty}</Badge>}
                        {p.is_new && <Badge variant="outline">New</Badge>}
                        {p.is_bestseller && <Badge variant="outline">Bestseller</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      <label className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!p.is_new}
                          onChange={(e) => handleFlag(p.id, "is_new", e.target.checked)}
                          className="h-3.5 w-3.5 accent-burgundy"
                        />
                        New Arrival
                      </label>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!p.is_bestseller}
                          onChange={(e) => handleFlag(p.id, "is_bestseller", e.target.checked)}
                          className="h-3.5 w-3.5 accent-burgundy"
                        />
                        Bestseller
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to="/admin/products/$id"
                        params={{ id: p.id }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:border-gold"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}