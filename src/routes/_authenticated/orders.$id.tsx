import { pageTitle } from "@/lib/seo";
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
  head: () => ({ meta: [{ title: pageTitle("Order Details") }] }),
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
        .select("*, order_items(*), shipments(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Loading…</p></MobileShell>;
  if (!data) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Order not found</p></MobileShell>;

  type Ship = { id: string; status: string; tracking_number: string | null; dispatched_at: string | null; delivered_at: string | null; created_at: string };
  type Item = { id: string; product_name: string; product_sku: string | null; quantity: number; size: string | null; image_url: string | null; status: string; shipment_id: string | null; gross_weight?: number | string | null; remark?: string | null };
  const allItems = ((data.order_items ?? []) as unknown as Item[]);
  const shipments = ((data as unknown as { shipments?: Ship[] }).shipments ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const multi = shipments.length > 1;

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

        {!isCancelled && multi && (
          <section className="space-y-3">
            {shipments.map((sh, si) => {
              const shipItems = allItems.filter((it) => it.shipment_id === sh.id);
              const shipIdx = TIMELINE.findIndex((t) => t.key === sh.status);
              return (
                <div key={sh.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-serif text-sm font-semibold">
                        Shipment {si + 1} of {shipments.length} — {shipItems.length} item{shipItems.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {shipItems.map((it) => it.product_sku || it.product_name).join(", ") || "—"}
                      </p>
                    </div>
                    <Badge className="capitalize">{STATUS_LABEL[sh.status] ?? sh.status}</Badge>
                  </div>
                  {sh.tracking_number && (
                    <p className="mt-2 rounded-md bg-secondary p-2 text-[11px]">
                      <span className="font-semibold">Tracking / AWB: </span>
                      <span className="font-mono">{sh.tracking_number}</span>
                    </p>
                  )}
                  <ol className="mt-3 space-y-2">
                    {TIMELINE.map((t, i) => {
                      const done = shipIdx >= 0 && i <= shipIdx;
                      const Icon = done ? t.Icon : Circle;
                      return (
                        <li key={t.key} className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${done ? "border-burgundy bg-burgundy text-white" : "border-border bg-background text-muted-foreground"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <p className={`text-xs ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{t.label}</p>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
            {allItems.some((it) => !it.shipment_id && it.status !== "cancelled") && (
              <div className="rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Awaiting production: </span>
                {allItems.filter((it) => !it.shipment_id && it.status !== "cancelled").map((it) => it.product_sku || it.product_name).join(", ")}
              </div>
            )}
          </section>
        )}

        {!isCancelled && !multi && (
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
                  </p>
                  {(it as { remark?: string | null }).remark && (
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary p-2 text-[11px]">
                      <span className="font-semibold">Item Remarks: </span>
                      {(it as { remark?: string | null }).remark}
                    </p>
                  )}

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

