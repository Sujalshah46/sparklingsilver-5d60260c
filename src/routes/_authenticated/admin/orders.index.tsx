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
import { rollupStatus } from "@/lib/order-rollup";
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

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-green-100 text-green-900",
  rejected: "bg-destructive/15 text-destructive",
  confirmed: "bg-emerald-100 text-emerald-900",
  processing: "bg-gold/20 text-charcoal",
  ready: "bg-gold/20 text-charcoal",
  dispatched: "bg-blue-100 text-blue-900",
  out_for_delivery: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-muted text-muted-foreground",
  placed: "bg-secondary text-foreground",
};

function AdminOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
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
          "id, order_no, status, customer_name, customer_phone, customer_email, customer_city, created_at, order_items(status)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return (orders ?? []).filter((o) => {
      const r = rollups.get(o.id);
      if (tab !== "all" && o.status !== tab) return false;
      if (pendingItemsOnly && !(r?.split && (r.counts.confirmed ?? 0) > 0)) return false;
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
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, tab, search, fromDate, toDate, pendingItemsOnly, rollups]);

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
              placeholder="Search order #, name, phone, email, city"
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

        <div className="mb-3">
          <Button
            type="button"
            size="sm"
            variant={pendingItemsOnly ? "default" : "outline"}
            onClick={() => setPendingItemsOnly((v) => !v)}
            className="h-8 text-xs"
          >
            Has pending items
          </Button>
        </div>

        <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
          {STATUS_TABS.map((t) => {
            const count =
              t === "all"
                ? (orders?.length ?? 0)
                : (orders ?? []).filter((o) => o.status === t).length;
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
          {filtered.length} {filtered.length === 1 ? "order" : "orders"}
          {hasFilters && " matching filters"}
        </p>

        {filtered.length === 0 ? (
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
                      <Badge className={statusColor[rollups.get(o.id)?.status ?? o.status] ?? ""}>
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
