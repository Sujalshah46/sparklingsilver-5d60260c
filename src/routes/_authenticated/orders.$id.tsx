import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { inr, formatDate } from "@/lib/format";
import { resolveProductImage } from "@/lib/product-images";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [{ title: "Order Details — Sparkling Silver" }] }),
  component: OrderDetail,
});

const STAGES = ["pending", "accepted", "dispatched", "delivered"];

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

  const currentStage = STAGES.indexOf(data.status);
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
            <Badge>{data.status}</Badge>
          </div>

          {data.status !== "cancelled" && (
            <ol className="mt-5 flex justify-between text-[10px] uppercase tracking-wider">
              {STAGES.map((s, i) => (
                <li key={s} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${i <= currentStage ? "bg-burgundy" : "bg-border"}`} />
                  <span className={i <= currentStage ? "font-semibold text-burgundy" : "text-muted-foreground"}>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Items</h3>
          <div className="space-y-2">
            {data.order_items?.map((it) => (
              <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <img src={resolveProductImage(it.image_url)} alt={it.product_name} width={64} height={64} loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-serif text-sm font-semibold">{it.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">SKU {it.product_sku} · Qty {it.quantity}{it.size ? ` · Size ${it.size}` : ""}</p>
                  <p className="mt-1 font-semibold text-burgundy">{inr(Number(it.unit_price) * it.quantity)}</p>
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

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Payment</h3>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p>Method: <span className="font-semibold capitalize">{data.payment_method ?? "—"}</span></p>
            <p>Status: <span className="font-semibold capitalize">{data.payment_status}</span></p>
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-muted-foreground">
              <Row label="Subtotal" value={inr(data.subtotal)} />
              <Row label="GST" value={inr(data.gst)} />
              <div className="mt-1 flex justify-between text-base font-semibold text-foreground"><span>Total</span><span className="font-serif text-burgundy">{inr(data.total)}</span></div>
            </div>
          </div>
        </section>
      </div>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>;
}
