import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { inr, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [{ title: "Admin — Orders" }] }),
  component: AdminOrders,
});

const STATUS_TABS = ["pending", "accepted", "rejected", "all"] as const;
type Tab = (typeof STATUS_TABS)[number];

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-green-100 text-green-900",
  rejected: "bg-destructive/15 text-destructive",
  processing: "bg-gold/20 text-charcoal",
  ready: "bg-gold/20 text-charcoal",
  dispatched: "bg-blue-100 text-blue-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-muted text-muted-foreground",
  placed: "bg-secondary text-foreground",
};

function AdminOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_no, status, total, customer_name, customer_phone, customer_city, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
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
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const pendingCount = useMemo(
    () => (orders ?? []).filter((o) => o.status === "pending").length,
    [orders],
  );
  useEffect(() => {
    const base = "Admin — Orders";
    document.title = pendingCount > 0 ? `(${pendingCount}) ${base}` : base;
    return () => { document.title = base; };
  }, [pendingCount]);

  const filtered = (orders ?? []).filter((o) => (tab === "all" ? true : o.status === tab));

  return (
    <MobileShell title="Orders">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="font-serif text-xl font-semibold">Orders</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
          {STATUS_TABS.map((t) => {
            const count = t === "all" ? orders?.length ?? 0 : (orders ?? []).filter((o) => o.status === t).length;
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
                      <p className="font-serif text-sm font-semibold">{o.order_no}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.customer_name ?? "—"} · {o.customer_phone ?? ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(o.created_at)} · {o.customer_city ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={statusColor[o.status] ?? ""}>{o.status}</Badge>
                      <span className="font-serif text-sm font-semibold text-burgundy">{inr(o.total)}</span>
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
