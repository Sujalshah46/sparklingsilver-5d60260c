import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { resolveProductImage } from "@/lib/product-images";
import { rollupStatus, STATUS_LABEL as ITEM_STATUS_LABEL, statusBadgeClass } from "@/lib/order-rollup";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Package,
  Truck,
  Bike,
  PackageCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [{ title: pageTitle("Order Details") }] }),
  component: OrderDetail,
});

const TIMELINE = [
  { key: "pending", label: "Order Placed", Icon: CheckCircle2 },
  { key: "accepted", label: "Order Received", Icon: ClipboardCheck },
  { key: "confirmed", label: "Confirmed", Icon: ClipboardCheck },
  { key: "processing", label: "Processing", Icon: Package },
  { key: "dispatched", label: "Dispatched", Icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery", Icon: Bike },
  { key: "delivered", label: "Delivered", Icon: PackageCheck },
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
    refetchOnWindowFocus: true,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*, item_status_history(*)), shipments(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });


  if (isLoading)
    return (
      <MobileShell title="Order">
        <p className="p-8 text-center text-muted-foreground">Loading…</p>
      </MobileShell>
    );
  if (!data)
    return (
      <MobileShell title="Order">
        <p className="p-8 text-center text-muted-foreground">Order not found</p>
      </MobileShell>
    );

  type Ship = {
    id: string;
    status: string;
    tracking_number: string | null;
    created_at: string;
  };
  const allItems = (data.order_items ?? []) as unknown as ItemRow[];
  const shipments = ((data as unknown as { shipments?: Ship[] }).shipments ?? []).slice();
  const trackingByShipment: Record<string, string | null> = {};
  for (const sh of shipments) trackingByShipment[sh.id] = sh.tracking_number;

  const roll = rollupStatus(
    allItems.map((i) => i.status ?? (data.status as string)),
    data.status as string,
  );
  const status = roll.status as string;
  const isCancelled = status === "cancelled" || status === "rejected";


  const ship = data.shipping_address as {
    recipient_name: string;
    mobile: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };

  return (
    <MobileShell title={data.order_no}>
      <div className="space-y-5 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-lg font-semibold">{data.order_no}</p>
              <p className="text-xs text-muted-foreground">
                Placed on {formatDate(data.created_at)}
              </p>
            </div>
            <Badge data-testid="order-rollup" className={`capitalize ${statusBadgeClass(roll.status)}`}>{roll.label}</Badge>
          </div>

          {data.tracking_number && (
            <p className="mt-3 rounded-md bg-secondary p-2 text-xs">
              <span className="font-semibold">Tracking / AWB: </span>
              <span className="font-mono">{data.tracking_number}</span>
            </p>
          )}
        </div>


        {isCancelled && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            This order was {status === "rejected" ? "not accepted" : "cancelled"}.
            {data.admin_notes && <p className="mt-2 text-xs">Reason: {data.admin_notes}</p>}
          </div>
        )}

        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Items</h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Tap an item to see its own order timeline.
          </p>
          <div className="space-y-2">
            {allItems.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                fallbackStatus={status}
                tracking={trackingByShipment[it.shipment_id ?? ""] ?? null}
              />
            ))}
          </div>
        </section>


        <section>
          <h3 className="mb-2 font-serif text-base font-semibold">Shipping Address</h3>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">
              {ship.recipient_name} · {ship.mobile}
            </p>
            <p className="text-muted-foreground">
              {ship.line1}
              {ship.line2 ? `, ${ship.line2}` : ""}, {ship.city}, {ship.state} {ship.pincode}
            </p>
          </div>
        </section>
      </div>
    </MobileShell>
  );
}
