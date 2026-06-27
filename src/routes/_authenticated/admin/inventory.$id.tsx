import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setStock, updateThreshold } from "@/lib/inventory.functions";
import { categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/inventory/$id")({
  head: () => ({ meta: [{ title: "Admin — Stock detail" }] }),
  component: StockDetail,
});

function StockDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const setQty = useServerFn(setStock);
  const setThr = useServerFn(updateThreshold);

  const { data: product } = useQuery({
    queryKey: ["admin-inv-product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, sku, image_url, stock_quantity, low_stock_threshold, in_stock")
        .eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["admin-inv-movements", id],
    queryFn: async () => {
      const { data } = await supabase.from("stock_movements")
        .select("id, delta, previous_qty, new_qty, reason, created_at")
        .eq("product_id", id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const [qty, setQtyState] = useState<string>("");
  const [thr, setThrState] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (product) {
      setQtyState(String(product.stock_quantity ?? 0));
      setThrState(String(product.low_stock_threshold ?? 0));
    }
  }, [product]);

  if (!product) {
    return <MobileShell title="Loading"><div className="p-4 text-sm text-muted-foreground">Loading…</div></MobileShell>;
  }

  async function saveQty() {
    const n = parseInt(qty || "0", 10);
    if (Number.isNaN(n) || n < 0) return toast.error("Enter a valid quantity");
    try {
      await setQty({ data: { product_id: id, quantity: n, reason: reason || "Manual set" } });
      qc.invalidateQueries({ queryKey: ["admin-inv-product", id] });
      qc.invalidateQueries({ queryKey: ["admin-inv-movements", id] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      toast.success("Stock updated");
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function saveThr() {
    const n = parseInt(thr || "0", 10);
    if (Number.isNaN(n) || n < 0) return toast.error("Enter a valid threshold");
    try {
      await setThr({ data: { product_id: id, low_stock_threshold: n } });
      qc.invalidateQueries({ queryKey: ["admin-inv-product", id] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      toast.success("Threshold updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <MobileShell title="Stock detail">
      <div className="p-4 space-y-4">
        <Link to="/admin/inventory" className="text-xs text-muted-foreground hover:text-foreground">← Inventory</Link>

        <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
          <img
            src={resolveProductImage(product.image_url, categoryPlaceholder)}
            alt={product.name}
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
            className="h-20 w-20 shrink-0 rounded-lg bg-secondary object-cover"
          />
          <div className="min-w-0">
            <p className="font-serif text-base font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.sku}</p>
            <p className="mt-1 text-xs">{product.in_stock ? "In stock" : "Out of stock"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div>
            <Label htmlFor="qty">Set stock quantity</Label>
            <Input id="qty" type="number" min={0} value={qty} onChange={(e) => setQtyState(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Restocked from supplier" />
          </div>
          <Button onClick={saveQty} className="w-full">Save quantity</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div>
            <Label htmlFor="thr">Low-stock threshold</Label>
            <Input id="thr" type="number" min={0} value={thr} onChange={(e) => setThrState(e.target.value)} />
          </div>
          <Button variant="outline" onClick={saveThr} className="w-full">Save threshold</Button>
        </div>

        <div>
          <h2 className="mb-2 font-serif text-sm font-semibold">Recent movements</h2>
          {(movements ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No movements yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {movements!.map((m) => (
                <li key={m.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${m.delta >= 0 ? "text-green-700" : "text-destructive"}`}>
                      {m.delta >= 0 ? "+" : ""}{m.delta}
                    </span>
                    <span className="text-muted-foreground">{m.previous_qty} → {m.new_qty}</span>
                  </div>
                  {m.reason && <p className="text-muted-foreground">{m.reason}</p>}
                  <p className="text-[10px] text-muted-foreground">{formatDate(m.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
