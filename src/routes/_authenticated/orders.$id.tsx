import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { resolveProductImage } from "@/lib/product-images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ClipboardCheck, Package, Truck, Bike, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [{ title: "Order Details — Sparkling Silver" }] }),
  component: OrderDetail,
});

const TIMELINE = [
  { key: "pending",          label: "Order Placed",       Icon: CheckCircle2 },
  { key: "accepted",         label: "Order Received",     Icon: ClipboardCheck },
  { key: "confirmed",        label: "Confirmed",          Icon: ClipboardCheck },
  { key: "processing",       label: "Processing",         Icon: Package },
  { key: "dispatched",       label: "Dispatched",         Icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery",   Icon: Bike },
  { key: "delivered",        label: "Delivered",          Icon: PackageCheck },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Received",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  dispatched: "Dispatched",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function OrderDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Loading…</p></MobileShell>;
  if (!data) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Order not found</p></MobileShell>;

  const status = data.status as string;
  const isCancelled = status === "cancelled" || status === "rejected";
  const activeIdx = TIMELINE.findIndex((s) => s.key === status);
  const ship = data.shipping_address as { recipient_name: string; mobile: string; line1: string; line2?: string; city: string; state: string; pincode: string };



  return (
    <MobileShell title={data.order_no}>
      <div className="space-y-5 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-lg font-semibold">{data.order_no}</p>
              <p className="text-xs text-muted-foreground">Placed on {formatDate(data.created_at)}</p>
            </div>
            <Badge className="capitalize">{STATUS_LABEL[status] ?? status}</Badge>
          </div>

          {data.tracking_number && (
            <p className="mt-3 rounded-md bg-secondary p-2 text-xs">
              <span className="font-semibold">Tracking / AWB: </span>
              <span className="font-mono">{data.tracking_number}</span>
            </p>
          )}
        </div>

        {!isCancelled && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-serif text-base font-semibold">Order timeline</h3>
            <ol className="space-y-3">
              {TIMELINE.map((s, i) => {
                const done = activeIdx >= 0 && i <= activeIdx;
                const current = i === activeIdx;
                const Icon = done ? s.Icon : Circle;
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${done ? "border-burgundy bg-burgundy text-white" : "border-border bg-background text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                      {current && <p className="text-[11px] text-burgundy">Current status</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {isCancelled && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This order was {status === "rejected" ? "not accepted" : "cancelled"}.
            {data.admin_notes && <p className="mt-2 text-xs">Reason: {data.admin_notes}</p>}
          </div>
        )}

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Items</h3>
          <div className="space-y-2">
            {data.order_items?.map((it) => (
              <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <img src={resolveProductImage(it.image_url)} alt={it.product_name} width={64} height={64} loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-serif text-sm font-semibold">{it.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">SKU {it.product_sku} · Qty {it.quantity}{it.size ? ` · Size ${it.size}` : ""}</p>
                  <p className="mt-1 text-[11px] text-[#555]">
                    <span className="font-semibold text-[#333]">Gross:</span> {Number((it as { gross_weight?: number | string | null }).gross_weight ?? 0).toFixed(3)} g
                    <span className="mx-1.5">·</span>
                    <span className="font-semibold text-[#333]">Net:</span> {Number((it as { net_weight?: number | string | null }).net_weight ?? 0).toFixed(3)} g
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Shipping Address</h3>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">{ship.recipient_name} · {ship.mobile}</p>
            <p className="text-muted-foreground">{ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}, {ship.city}, {ship.state} {ship.pincode}</p>
          </div>
        </section>

      </div>
    </MobileShell>
  );
}

