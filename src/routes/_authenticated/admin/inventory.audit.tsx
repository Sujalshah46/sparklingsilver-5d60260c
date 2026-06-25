import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/inventory/audit")({
  head: () => ({ meta: [{ title: "Admin — Audit log" }] }),
  component: AuditLog,
});

type Move = "all" | "in" | "out" | "noop";

function AuditLog() {
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState<string>("all");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [move, setMove] = useState<Move>("all");

  const { data: products } = useQuery({
    queryKey: ["audit-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku").order("name");
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["audit", productId, from, to, move],
    queryFn: async () => {
      let qb = supabase.from("stock_movements")
        .select("id, product_id, delta, previous_qty, new_qty, reason, created_at, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (productId !== "all") qb = qb.eq("product_id", productId);
      if (from) qb = qb.gte("created_at", new Date(from + "T00:00:00").toISOString());
      if (to) qb = qb.lte("created_at", new Date(to + "T23:59:59").toISOString());
      if (move === "in") qb = qb.gt("delta", 0);
      if (move === "out") qb = qb.lt("delta", 0);
      if (move === "noop") qb = qb.eq("delta", 0);
      const { data } = await qb;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r: any) => {
      const p = r.products;
      return p?.name?.toLowerCase().includes(s) || p?.sku?.toLowerCase().includes(s) || r.reason?.toLowerCase().includes(s);
    });
  }, [rows, q]);

  return (
    <MobileShell title="Audit log">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-serif text-xl font-semibold">Audit log</h1>
          <Link to="/admin/inventory" className="text-xs text-muted-foreground hover:text-foreground">← Inventory</Link>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, SKU or reason" className="pl-9" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px]">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-[11px]">Product</Label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All products</option>
            {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select>
        </div>

        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["all", "in", "out", "noop"] as const).map((m) => (
            <button key={m} onClick={() => setMove(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                move === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}>
              {m === "all" ? "All" : m === "in" ? "Stock in" : m === "out" ? "Stock out" : "No change"}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">{filtered.length} movement{filtered.length === 1 ? "" : "s"}</p>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No movements match these filters.</p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((r: any) => {
              const Icon = r.delta > 0 ? TrendingUp : r.delta < 0 ? TrendingDown : Minus;
              const color = r.delta > 0 ? "text-green-700" : r.delta < 0 ? "text-destructive" : "text-muted-foreground";
              return (
                <li key={r.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-serif text-sm font-semibold truncate">{r.products?.name ?? "—"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.products?.sku ?? ""}</p>
                      {r.reason && <p className="mt-0.5 text-muted-foreground">{r.reason}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(r.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge className={`bg-secondary ${color}`}>
                        <Icon className="mr-1 h-3 w-3" />
                        {r.delta > 0 ? "+" : ""}{r.delta}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{r.previous_qty} → {r.new_qty}</span>
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
