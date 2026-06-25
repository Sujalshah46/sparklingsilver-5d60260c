import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { inr, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Package, ShoppingBag, Users, IndianRupee, Clock, MessageSquare, Boxes } from "lucide-react";
import { toast } from "sonner";
import { ensurePushSubscription, serializeSubscription } from "@/lib/push";
import { savePushSubscription } from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Dashboard" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const qc = useQueryClient();
  const [pushOn, setPushOn] = useState(false);
  const saveSub = useServerFn(savePushSubscription);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      const [ordersAll, ordersRecent, products, customers, enquiries] = await Promise.all([
        supabase.from("orders").select("id, status, total, created_at"),
        supabase
          .from("orders")
          .select("id, order_no, status, total, customer_name, customer_city, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("id", { count: "exact", head: true }),
      ]);

      const rows = ordersAll.data ?? [];
      const pending = rows.filter((o) => o.status === "pending").length;
      const accepted = rows.filter((o) => o.status === "accepted").length;
      const last7 = rows.filter((o) => o.created_at >= since7);
      const today = rows.filter((o) => o.created_at >= sinceToday);
      const revenue7 = last7
        .filter((o) => ["accepted", "processing", "ready", "dispatched", "delivered"].includes(o.status))
        .reduce((s, o) => s + Number(o.total ?? 0), 0);

      return {
        totalOrders: rows.length,
        pending,
        accepted,
        ordersToday: today.length,
        revenue7,
        productCount: products.count ?? 0,
        customerCount: customers.count ?? 0,
        newEnquiries: enquiries.count ?? 0,
        recent: ordersRecent.data ?? [],
      };
    },
  });

  // Realtime — refresh on order changes
  useEffect(() => {
    const ch = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
        if (payload.eventType === "INSERT") toast.success("New order received");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Tab title with pending count
  useEffect(() => {
    const base = "Admin — Dashboard";
    const p = stats?.pending ?? 0;
    document.title = p > 0 ? `(${p}) ${base}` : base;
    return () => { document.title = base; };
  }, [stats?.pending]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPushOn(Notification.permission === "granted");
  }, []);

  async function enablePush() {
    try {
      const sub = await ensurePushSubscription();
      if (!sub) { toast.error("Notifications were not granted"); return; }
      const s = serializeSubscription(sub);
      await saveSub({ data: { ...s, user_agent: navigator.userAgent.slice(0, 500) } });
      setPushOn(true);
      toast.success("Push notifications enabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable push");
    }
  }

  const statCards = [
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock, accent: "text-amber-700 bg-amber-50" },
    { label: "Orders today", value: stats?.ordersToday ?? 0, icon: ShoppingBag, accent: "text-burgundy bg-burgundy/10" },
    { label: "Revenue · 7d", value: inr(stats?.revenue7 ?? 0), icon: IndianRupee, accent: "text-green-800 bg-green-50" },
    { label: "Total orders", value: stats?.totalOrders ?? 0, icon: Package, accent: "text-blue-800 bg-blue-50" },
    { label: "Products", value: stats?.productCount ?? 0, icon: Boxes, accent: "text-charcoal bg-gold/15" },
    { label: "Customers", value: stats?.customerCount ?? 0, icon: Users, accent: "text-purple-800 bg-purple-50" },
  ];

  return (
    <MobileShell title="Admin">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Live overview of your store</p>
          </div>
          <Button size="sm" variant={pushOn ? "outline" : "default"} onClick={enablePush}>
            {pushOn ? <><Bell className="mr-1 h-4 w-4" /> On</> : <><BellOff className="mr-1 h-4 w-4" /> Push</>}
          </Button>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3">
              <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.accent}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="font-serif text-lg font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-2 font-serif text-sm font-semibold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction to="/admin/orders" icon={ShoppingBag} label="Manage orders" badge={stats?.pending} />
            <QuickAction to="/products" icon={Boxes} label="View catalogue" />
            <QuickAction to="/account/enquiries" icon={MessageSquare} label="Enquiries" badge={stats?.newEnquiries} />
            <QuickAction to="/" icon={Package} label="Storefront" />
          </div>
        </div>

        {/* Recent orders */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs text-burgundy hover:underline">View all</Link>
          </div>
          {(stats?.recent ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No orders yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats!.recent.map((o) => (
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
                          {o.customer_name ?? "—"} · {o.customer_city ?? "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="capitalize">{o.status}</Badge>
                        <span className="font-serif text-sm font-semibold text-burgundy">{inr(o.total)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function QuickAction({
  to, icon: Icon, label, badge,
}: { to: string; icon: typeof Package; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-gold"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground group-hover:bg-gold/15">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-auto rounded-full bg-burgundy px-2 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
