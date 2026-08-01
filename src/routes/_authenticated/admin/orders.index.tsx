import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { rollupStatus, STATUS_LABEL, statusBadgeClass } from "@/lib/order-rollup";
import { resolveProductImage } from "@/lib/product-images";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Orders") }] }),
  component: AdminOrders,
});

const STATUS_TABS = [
  "pending",
  "accepted",
  "confirmed",
  "processing",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "rejected",
  "cancelled",
  "all",
] as const;
type Tab = (typeof STATUS_TABS)[number];


type ItemRow = {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  gross_weight: number | string | null;
  image_url: string | null;
  status: string;
};
type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_city: string | null;
  created_at: string;
  order_items?: ItemRow[] | null;
};

function AdminOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [mode, setMode] = useState<"order" | "sku">("order");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pendingItemsOnly, setPendingItemsOnly] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_no, status, customer_name, customer_phone, customer_email, customer_city, created_at, order_items(id, product_name, product_sku, quantity, gross_weight, image_url, status)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      return (data ?? []) as unknown as OrderRow[];
    },
  });


  useEffect(() => {
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
        qc.invalidateQueries({ queryKey: ["admin-order"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
        if (payload.eventType === "INSERT") toast.success("New order received");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const pendingCount = useMemo(
    () => (orders ?? []).filter((o) => o.status === "pending").length,
    [orders],
  );
  useEffect(() => {
    const base = "Admin — Orders";
    document.title = pendingCount > 0 ? `(${pendingCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [pendingCount]);

  const rollups = useMemo(() => {
    const map = new Map<string, ReturnType<typeof rollupStatus>>();
    for (const o of orders ?? []) {
      const statuses = ((o as { order_items?: { status: string }[] }).order_items ?? []).map(
        (i) => i.status,
      );
      map.set(o.id, rollupStatus(statuses.length ? statuses : [o.status], o.status));
    }
    return map;
  }, [orders]);

  /**
   * An order belongs to a status tab when its displayed rollup status matches,
   * or when any of its items still sits at that status (split orders).
   * Using the raw `orders.status` column here made orders disappear from the
   * tab their badge pointed at.
   */
  const matchesTab = useMemo(
    () => (o: OrderRow, t: Tab) => {
      if (t === "all") return true;
      if ((rollups.get(o.id)?.status ?? o.status) === t) return true;
      const items = o.order_items ?? [];
      if (items.length === 0) return o.status === t;
      return items.some((i) => (i.status ?? o.status) === t);
    },
    [rollups],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return (orders ?? []).filter((o) => {
      if (!matchesTab(o, tab)) return false;
      if (pendingItemsOnly) {
        const items = o.order_items ?? [];
        const hasPre = items.some((i) => ["pending", "accepted"].includes(i.status ?? o.status));
        if (!hasPre) return false;
      }
      if (fromTs || toTs) {
        const t = new Date(o.created_at).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      if (q) {
        const hay = [
          o.order_no,
          o.customer_name,
          o.customer_phone,
          o.customer_email,
          o.customer_city,
          ...(o.order_items ?? []).flatMap((i) => [i.product_sku, i.product_name]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, tab, search, fromDate, toDate, pendingItemsOnly, matchesTab]);


  /** Order+item pairs, filtered by date/search; status filtering happens per tab. */
  const skuRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    const rows: { item: ItemRow; order: OrderRow }[] = [];
    for (const o of orders ?? []) {
      if (fromTs || toTs) {
        const t = new Date(o.created_at).getTime();
        if (fromTs && t < fromTs) continue;
        if (toTs && t > toTs) continue;
      }
      for (const it of o.order_items ?? []) {
        if (q) {
          const hay = [
            o.order_no,
            o.customer_name,
            o.customer_phone,
            o.customer_email,
            o.customer_city,
            it.product_sku,
            it.product_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) continue;
        }
        rows.push({ item: it, order: o });
      }
    }
    return rows;
  }, [orders, search, fromDate, toDate]);

  const skuFiltered = useMemo(
    () => skuRows.filter((r) => tab === "all" || (r.item.status ?? r.order.status) === tab),
    [skuRows, tab],
  );

  const itemWeight = (i: ItemRow) => Number(i.gross_weight ?? 0) * Number(i.quantity ?? 0);
  const fmtWeight = (g: number) =>
    `${g.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;

  /** Total gross weight per status tab (sum of qty × gross weight of matching items). */
  const tabWeights = useMemo(() => {
    const map = new Map<Tab, number>();
    for (const t of STATUS_TABS) map.set(t, 0);
    for (const o of orders ?? []) {
      for (const it of o.order_items ?? []) {
        const st = (it.status ?? o.status) as Tab;
        const w = itemWeight(it);
        map.set("all", (map.get("all") ?? 0) + w);
        if (map.has(st)) map.set(st, (map.get(st) ?? 0) + w);
      }
    }
    return map;
  }, [orders]);

  /** Weight of what's currently on screen (respects search / date filters). */
  const visibleWeight = useMemo(() => {
    if (mode === "sku") return skuFiltered.reduce((s, r) => s + itemWeight(r.item), 0);
    return filtered.reduce(
      (s, o) =>
        s +
        (o.order_items ?? [])
          .filter((i) => tab === "all" || (i.status ?? o.status) === tab)
          .reduce((a, i) => a + itemWeight(i), 0),
      0,
    );
  }, [mode, skuFiltered, filtered, tab]);


  const hasFilters = !!(search || fromDate || toDate || pendingItemsOnly);
  const clearAll = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setPendingItemsOnly(false);
  };

  return (
    <MobileShell title="Orders">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="font-serif text-xl font-semibold">Orders</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                mode === "sku"
                  ? "Search SKU, product, order #, name, city"
                  : "Search order #, name, phone, email, city"
              }
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 flex-1 text-xs"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 flex-1 text-xs"
              aria-label="To date"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          {mode === "order" && (
            <Button
              type="button"
              size="sm"
              variant={pendingItemsOnly ? "default" : "outline"}
              onClick={() => setPendingItemsOnly((v) => !v)}
              className="h-8 text-xs"
            >
              Has pending items
            </Button>
          )}
          <div className="inline-flex rounded-md bg-secondary p-1">
            {(["order", "sku"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "order" ? "Order-wise" : "SKU-wise"}
              </button>
            ))}
          </div>
        </div>


        <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
          {STATUS_TABS.map((t) => {
            const count =
              mode === "sku"
                ? t === "all"
                  ? skuRows.length
                  : skuRows.filter((r) => (r.item.status ?? r.order.status) === t).length
                : t === "all"
                  ? (orders?.length ?? 0)
                  : (orders ?? []).filter((o) => matchesTab(o, t)).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t} {count > 0 && <span className="ml-1 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-[11px] text-muted-foreground">
          {mode === "sku"
            ? `${skuFiltered.length} ${skuFiltered.length === 1 ? "item" : "items"}`
            : `${filtered.length} ${filtered.length === 1 ? "order" : "orders"}`}
          {hasFilters && " matching filters"}
        </p>

        {mode === "sku" ? (
          skuFiltered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No items here.</p>
          ) : (
            <ul className="space-y-2">
              {skuFiltered.map(({ item, order }) => {
                const st = item.status ?? order.status;
                return (
                  <li key={item.id}>
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: order.id }}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-gold"
                    >
                      <img
                        src={resolveProductImage(item.image_url)}
                        alt={item.product_name}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm font-semibold">
                          {item.product_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          SKU {item.product_sku ?? "—"} · Qty {item.quantity}
                          {item.gross_weight != null
                            ? ` · ${Number(item.gross_weight).toFixed(3)} g`
                            : ""}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Order</span>{" "}
                          {order.order_no} · {order.customer_name ?? "—"} ·{" "}
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <Badge className={`shrink-0 capitalize ${statusBadgeClass(st)}`}>
                        {STATUS_LABEL[st] ?? st}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No orders here.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="block rounded-xl border border-border bg-card p-3 transition hover:border-gold"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-sm font-bold text-foreground">
                        {o.customer_name ?? "—"}
                      </p>
                      <p className="truncate text-xs font-bold text-foreground">
                        {o.order_no}
                        {o.customer_phone ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {o.customer_phone}
                          </span>
                        ) : null}
                      </p>

                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(o.created_at)} · {o.customer_city ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={statusBadgeClass(rollups.get(o.id)?.status ?? o.status)}>
                        {rollups.get(o.id)?.label ?? o.status}
                      </Badge>
                      {rollups.get(o.id)?.split && (
                        <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-charcoal">
                          Split
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
