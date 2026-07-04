import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { inr, formatDate } from "@/lib/format";
import { categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, ArrowLeft, Truck, PackageCheck, ClipboardCheck, Package, Bike } from "lucide-react";
import { updateOrderStatus } from "@/lib/admin.functions";

type OrderStatus = "pending" | "accepted" | "rejected" | "confirmed" | "processing" | "ready" | "dispatched" | "out_for_delivery" | "delivered" | "cancelled";



export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  head: () => ({ meta: [{ title: "Order — Admin" }] }),
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [tracking, setTracking] = useState("");
  const update = useServerFn(updateOrderStatus);


  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  // Realtime: refresh this order on any change.
  useEffect(() => {
    const ch = supabase
      .channel(`admin-order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["admin-order", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => { if (order?.admin_notes) setNotes(order.admin_notes); }, [order?.admin_notes]);
  useEffect(() => { if (order?.tracking_number) setTracking(order.tracking_number); }, [order?.tracking_number]);

  const mutate = useMutation({
    mutationFn: async (status: OrderStatus) =>
      update({ data: { order_id: id, status, admin_notes: notes || null, tracking_number: tracking || null } }),
    onSuccess: (_d, status) => {
      toast.success(`Order ${status.replace(/_/g, " ")}`);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (isLoading) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Loading…</p></MobileShell>;
  if (!order) return <MobileShell title="Order"><p className="p-8 text-center text-muted-foreground">Not found</p></MobileShell>;

  return (
    <MobileShell title={order.order_no}>
      <div className="space-y-4 p-4">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-burgundy">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-lg font-semibold">{order.order_no}</p>
              <p className="text-xs text-muted-foreground">Placed {formatDate(order.created_at)}</p>
            </div>
            <Badge className="capitalize">{order.status}</Badge>
          </div>
          <StageTracker status={order.status as OrderStatus} />
        </div>


        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-serif text-base font-semibold">Customer</h3>
          <p className="font-semibold">{order.customer_name}</p>
          <p className="text-muted-foreground">
            <a className="text-burgundy" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
            {" · "}
            <a className="text-burgundy" href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
          </p>
          <p className="mt-1 text-muted-foreground">
            {order.customer_address}, {order.customer_city} {order.customer_pincode}
          </p>
          {order.customer_notes && (
            <p className="mt-2 rounded-md bg-secondary p-2 text-xs">
              <span className="font-semibold">Note: </span>{order.customer_notes}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Items</h3>
          <div className="space-y-2">
            {order.order_items?.map((it) => (
              <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <img
                  src={resolveProductImage(it.image_url, categoryPlaceholder)}
                  alt={it.product_name}
                  width={64}
                  height={64}
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
                  <p className="line-clamp-1 font-serif text-sm font-semibold">{it.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">SKU {it.product_sku} · Qty {it.quantity}{it.size ? ` · Size ${it.size}` : ""}</p>
                  <p className="mt-1 font-semibold text-burgundy">{inr(Number(it.unit_price) * it.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-serif text-base font-semibold">Totals</h3>
          <Row label="Subtotal" value={inr(order.subtotal)} />
          <Row label="GST" value={inr(order.gst)} />
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span><span className="font-serif text-burgundy">{inr(order.total)}</span>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-serif text-base font-semibold">Tracking / AWB</h3>
          <Input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            maxLength={120}
            placeholder="Enter tracking ID / AWB (required before Out for Delivery)"
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-serif text-base font-semibold">Admin notes</h3>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Internal notes (visible to admins only)" />
        </section>

        <section className="space-y-2">
          {order.status === "pending" && (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={mutate.isPending} onClick={() => mutate.mutate("accepted")} className="bg-green-700 hover:bg-green-800">
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button disabled={mutate.isPending} variant="destructive" onClick={() => mutate.mutate("rejected")}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          )}
          {order.status === "accepted" && (
            <Button disabled={mutate.isPending} onClick={() => mutate.mutate("confirmed")} className="w-full bg-burgundy hover:bg-burgundy/90">
              <ClipboardCheck className="mr-1 h-4 w-4" /> Confirm Order
            </Button>
          )}
          {order.status === "confirmed" && (
            <Button disabled={mutate.isPending} onClick={() => mutate.mutate("processing")} className="w-full bg-burgundy hover:bg-burgundy/90">
              <Package className="mr-1 h-4 w-4" /> Start Processing
            </Button>
          )}
          {order.status === "processing" && (
            <Button disabled={mutate.isPending} onClick={() => mutate.mutate("dispatched")} className="w-full bg-burgundy hover:bg-burgundy/90">
              <Truck className="mr-1 h-4 w-4" /> Mark Dispatched
            </Button>
          )}
          {order.status === "dispatched" && (
            <Button
              disabled={mutate.isPending || !tracking.trim()}
              onClick={() => mutate.mutate("out_for_delivery")}
              className="w-full bg-burgundy hover:bg-burgundy/90"
              title={!tracking.trim() ? "Enter tracking / AWB first" : undefined}
            >
              <Bike className="mr-1 h-4 w-4" /> Out for Delivery
            </Button>
          )}
          {order.status === "out_for_delivery" && (
            <Button disabled={mutate.isPending} onClick={() => mutate.mutate("delivered")} className="w-full bg-green-700 hover:bg-green-800">
              <PackageCheck className="mr-1 h-4 w-4" /> Mark Delivered
            </Button>
          )}
          {(["accepted","confirmed","processing","dispatched","out_for_delivery"] as OrderStatus[]).includes(order.status as OrderStatus) && (
            <Button disabled={mutate.isPending} variant="outline" onClick={() => mutate.mutate("cancelled")} className="w-full">
              Cancel order
            </Button>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
