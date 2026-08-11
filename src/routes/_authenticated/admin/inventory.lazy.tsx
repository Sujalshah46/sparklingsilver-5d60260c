import { pageTitle } from "@/lib/seo";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Search, AlertTriangle, PackageX } from "lucide-react";
import { toast } from "sonner";
import { adjustStock, bulkApplyInventory } from "@/lib/inventory.functions";
import { categoryPlaceholder, resolveProductImage, productThumbUrl } from "@/lib/product-images";

export const Route = createLazyFileRoute("/_authenticated/admin/inventory")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Inventory") }] }),
  component: InventoryPage,
});

type Filter = "all" | "low" | "out";

function InventoryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const adjust = useServerFn(adjustStock);
  const bulkApply = useServerFn(bulkApplyInventory);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkQty, setBulkQty] = useState<string>("");
  const [bulkThr, setBulkThr] = useState<string>("");
  const [bulkReason, setBulkReason] = useState<string>("");

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const { data: products } = useQuery({
    queryKey: ["admin-inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, sku, image_url, stock_quantity, low_stock_threshold, in_stock, category_id")
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("inv-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const mut = useMutation({
    mutationFn: (vars: { product_id: string; delta: number }) =>
      adjust({ data: { product_id: vars.product_id, delta: vars.delta, reason: "Quick adjust" } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-inventory"] });
      const prev = qc.getQueryData<any[]>(["admin-inventory"]);
      qc.setQueryData<any[]>(["admin-inventory"], (old) =>
        (old ?? []).map((p) => p.id === vars.product_id
          ? { ...p, stock_quantity: Math.max(0, (p.stock_quantity ?? 0) + vars.delta) }
          : p));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-inventory"], ctx.prev);
      toast.error("Could not update stock");
    },
  });

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (search && !p.name.toLowerCase().includes(search) && !p.sku.toLowerCase().includes(search)) return false;
      const qty = p.stock_quantity ?? 0;
      const thr = p.low_stock_threshold ?? 0;
      if (filter === "out") return qty === 0;
      if (filter === "low") return qty > 0 && qty <= thr;
      return true;
    });
  }, [products, q, filter]);

  const counts = useMemo(() => {
    const list = products ?? [];
    return {
      all: list.length,
      low: list.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0)).length,
      out: list.filter((p) => (p.stock_quantity ?? 0) === 0).length,
    };
  }, [products]);

  return (
    <MobileShell title="Inventory">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-serif text-xl font-semibold">Inventory</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        <div className="flex gap-2">
          <Link to="/admin/inventory/import" className="flex-1 rounded-lg border border-border bg-card p-2 text-center text-xs font-medium hover:border-gold">
            Import CSV
          </Link>
          <Link to="/admin/inventory/audit" className="flex-1 rounded-lg border border-border bg-card p-2 text-center text-xs font-medium hover:border-gold">
            Audit log
          </Link>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="pl-9" />
        </div>

        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["all", "low", "out"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "low" ? "Low" : "Out"} <span className="ml-1 text-[10px]">({counts[f]})</span>
            </button>
          ))}
        </div>

        {filtered.length > 0 && (() => {
          const filteredIds = filtered.map((p) => p.id);
          const selectedInView = filteredIds.filter((id) => selected.has(id)).length;
          const allSelected = selectedInView === filteredIds.length;
          return (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => {
                    setSelected((s) => {
                      const n = new Set(s);
                      if (v) filteredIds.forEach((id) => n.add(id));
                      else filteredIds.forEach((id) => n.delete(id));
                      return n;
                    });
                  }}
                />
                <span className="font-medium">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </label>
              <div className="flex gap-1">
                {selected.size > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selected.size === 0}
                  onClick={() => { setBulkQty(""); setBulkThr(""); setBulkReason(""); setBulkOpen(true); }}
                >
                  Bulk update
                </Button>
              </div>
            </div>
          );
        })()}

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => {
              const qty = p.stock_quantity ?? 0;
              const thr = p.low_stock_threshold ?? 0;
              const out = qty === 0;
              const low = !out && qty <= thr;
              const isSel = selected.has(p.id);
              return (
                <li key={p.id} className={`rounded-xl border bg-card p-3 ${isSel ? "border-burgundy ring-1 ring-burgundy/30" : "border-border"}`}>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSel} onCheckedChange={() => toggleOne(p.id)} className="shrink-0" />
                    <img
                      src={productThumbUrl(resolveProductImage(p.image_url, categoryPlaceholder), { width: 112, quality: 55 })}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback === "1") {
                          img.alt = "";
                          img.style.visibility = "hidden";
                          return;
                        }
                        img.dataset.fallback = "1";
                        img.src = categoryPlaceholder;
                      }}
                      className="h-14 w-14 shrink-0 rounded-lg bg-secondary object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.sku}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {out && <Badge className="bg-destructive/15 text-destructive"><PackageX className="mr-1 h-3 w-3" />Out</Badge>}
                        {low && <Badge className="bg-amber-100 text-amber-900"><AlertTriangle className="mr-1 h-3 w-3" />Low</Badge>}
                        {!out && !low && <Badge className="bg-green-100 text-green-900">In stock</Badge>}
                        <span className="text-[11px] text-muted-foreground">threshold {thr}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8"
                        disabled={qty === 0 || mut.isPending}
                        onClick={() => mut.mutate({ product_id: p.id, delta: -1 })}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-[2ch] text-center font-serif text-base font-semibold">{qty}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ product_id: p.id, delta: 1 })}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-3">
                    <Link to="/admin/inventory/$id" params={{ id: p.id }}
                      className="text-[11px] text-muted-foreground hover:underline">Stock log →</Link>
                    <Link to="/admin/products/$id" params={{ id: p.id }}
                      className="text-[11px] text-burgundy hover:underline">Edit details →</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk update {selected.size} product{selected.size === 1 ? "" : "s"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Leave a field blank to keep existing values. Filled fields apply to every selected product.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-qty" className="text-xs">Set stock quantity</Label>
              <Input id="bulk-qty" type="number" min={0} inputMode="numeric" placeholder="e.g. 5"
                value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-thr" className="text-xs">Set low-stock threshold</Label>
              <Input id="bulk-thr" type="number" min={0} inputMode="numeric" placeholder="e.g. 2"
                value={bulkThr} onChange={(e) => setBulkThr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-reason" className="text-xs">Reason (optional)</Label>
              <Input id="bulk-reason" placeholder="Stock reset" maxLength={200}
                value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const qty = bulkQty.trim() === "" ? null : Number(bulkQty);
                const thr = bulkThr.trim() === "" ? null : Number(bulkThr);
                if (qty === null && thr === null) { toast.error("Enter quantity or threshold"); return; }
                if (qty !== null && (!Number.isFinite(qty) || qty < 0)) { toast.error("Invalid quantity"); return; }
                if (thr !== null && (!Number.isFinite(thr) || thr < 0)) { toast.error("Invalid threshold"); return; }
                try {
                  const ids = Array.from(selected);
                  const CHUNK = 100;
                  let updated = 0, failed = 0;
                  for (let i = 0; i < ids.length; i += CHUNK) {
                    const res = await bulkApply({ data: {
                      product_ids: ids.slice(i, i + CHUNK),
                      quantity: qty,
                      low_stock_threshold: thr,
                      reason: bulkReason.trim() || null,
                    }});
                    updated += res.updated;
                    failed += res.failed;
                  }
                  toast.success(`Updated ${updated}${failed ? `, ${failed} failed` : ""}`);
                  setBulkOpen(false);
                  setSelected(new Set());
                  qc.invalidateQueries({ queryKey: ["admin-inventory"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Bulk update failed");
                }

              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
