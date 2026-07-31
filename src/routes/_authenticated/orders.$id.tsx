import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { resolveProductImage } from "@/lib/product-images";
import { rollupStatus, STATUS_LABEL as ITEM_STATUS_LABEL, statusBadgeClass } from "@/lib/order-rollup";
import { cancelOwnOrderItems, BUYER_CANCELLABLE } from "@/lib/order-cancel.functions";
import { toast } from "sonner";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Package,
  Truck,
  Bike,
  PackageCheck,
  XCircle,
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

/** Items still before the "processing" stage haven't entered production yet. */
const PRE_PRODUCTION = new Set(["pending", "accepted", "confirmed"]);
function isAwaitingProduction(status: string) {
  return PRE_PRODUCTION.has(status);
}

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

        {!isCancelled && allItems.some((i) => isAwaitingProduction(i.status ?? status)) && (
          <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="font-semibold">Awaiting production: </span>
            {allItems
              .filter((i) => isAwaitingProduction(i.status ?? status))
              .map((i) => i.product_sku || i.product_name)
              .join(", ")}
            <p className="mt-1 opacity-80">These items have not gone into production yet.</p>
          </div>
        )}

        {!isCancelled && (
          <CancelPanel
            orderId={id}
            items={allItems.map((i) => ({
              id: i.id,
              status: i.status ?? status,
              label: i.product_sku || i.product_name,
              name: i.product_name,
            }))}
          />
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
                placedAt={data.created_at as string}
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

type ItemRow = {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  size: string | null;
  image_url: string | null;
  status: string;
  shipment_id: string | null;
  gross_weight?: number | string | null;
  remark?: string | null;
  status_updated_at?: string | null;
  item_status_history?: { to_status: string; changed_at: string }[] | null;
};

function ItemCard({
  item,
  fallbackStatus,
  placedAt,
  tracking,
}: {
  item: ItemRow;
  fallbackStatus: string;
  placedAt?: string | null;
  tracking: string | null;
}) {
  const [open, setOpen] = useState(false);
  const st = item.status ?? fallbackStatus;
  const idx = TIMELINE.findIndex((t) => t.key === st);
  const cancelled = st === "cancelled" || st === "rejected";

  // Earliest timestamp per stage from this item's own history.
  const when: Record<string, string> = {};
  for (const h of item.item_status_history ?? []) {
    if (!h?.to_status || !h?.changed_at) continue;
    if (!(h.to_status in when)) when[h.to_status] = h.changed_at;
  }
  // "Order Placed" is never written to history — it happens when the order is created.
  if (!when.pending && placedAt) when.pending = placedAt;
  // Current stage always shows a time, even if history wasn't recorded for it.
  if (!when[st] && item.status_updated_at) when[st] = item.status_updated_at;


  const awaiting = !cancelled && isAwaitingProduction(st);

  return (
    <div
      className={`rounded-xl border bg-card ${awaiting ? "border-amber-400 ring-1 ring-amber-300/60 bg-amber-50/60 dark:bg-amber-500/5" : "border-border"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full gap-3 p-3 text-left"
      >
        <img
          src={resolveProductImage(item.image_url)}
          alt={item.product_name}
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 font-serif text-sm font-semibold">{item.product_name}</p>
            <Badge
              data-testid={`item-status-${item.id}`}
              variant="secondary"
              className={`shrink-0 text-[10px] capitalize ${statusBadgeClass(st)}`}
            >
              {ITEM_STATUS_LABEL[st] ?? st}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            SKU {item.product_sku} · Qty {item.quantity}
            {item.size ? ` · Size ${item.size}` : ""}
          </p>
          {awaiting && (
            <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
              Awaiting production
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Gross:</span>{" "}
            {Number(item.gross_weight ?? 0).toFixed(3)} g
          </p>
          {item.remark && (
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary p-2 text-[11px]">
              <span className="font-semibold">Item Remarks: </span>
              {item.remark}
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-burgundy">
            {open ? "Hide" : "View"} order timeline
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {tracking && (
            <p className="mb-3 rounded-md bg-secondary p-2 text-[11px]">
              <span className="font-semibold">Tracking / AWB: </span>
              <span className="font-mono">{tracking}</span>
            </p>
          )}
          {cancelled ? (
            <p className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              This item was {st === "rejected" ? "not accepted" : "cancelled"}.
            </p>
          ) : (
            <ol className="space-y-3">
              {TIMELINE.map((s, i) => {
                const done = idx >= 0 && i <= idx;
                const current = i === idx;
                const Icon = done ? s.Icon : Circle;
                const at = when[s.key];
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${done ? "border-burgundy bg-burgundy text-white" : "border-border bg-background text-muted-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.label}
                      </p>
                      {at && <p className="text-[11px] text-muted-foreground">{formatDateTime(at)}</p>}
                      {current && <p className="text-[11px] text-burgundy">Current status</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

type CancelItem = { id: string; status: string; label: string; name: string };

const CANCELLABLE = new Set<string>(BUYER_CANCELLABLE as unknown as string[]);

/**
 * Buyer-side "change my mind" panel: cancel individual SKUs or the whole order
 * as long as the items have not been confirmed by the team yet.
 */
function CancelPanel({ orderId, items }: { orderId: string; items: CancelItem[] }) {
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelOwnOrderItems);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<null | "items" | "order">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const open = items.filter((i) => CANCELLABLE.has(i.status));
  if (open.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await cancelFn({
        data: {
          order_id: orderId,
          item_ids: mode === "items" ? selected : undefined,
          reason: reason.trim() || null,
        },
      });
      toast.success(
        res.orderCancelled
          ? "Your order has been cancelled."
          : `${res.cancelled} item${res.cancelled > 1 ? "s" : ""} cancelled.`,
      );
      setMode(null);
      setSelected([]);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["order", orderId] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-serif text-base font-semibold">Need changes?</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        You can cancel items or the entire order until we confirm it. Once confirmed, please reach us
        on WhatsApp.
      </p>

      <div className="mt-3 space-y-2">
        {open.map((i) => (
          <label
            key={i.id}
            className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm"
          >
            <Checkbox
              checked={selected.includes(i.id)}
              onCheckedChange={() => toggle(i.id)}
              aria-label={`Select ${i.label}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{i.name}</span>
              <span className="text-[11px] text-muted-foreground">SKU {i.label}</span>
            </span>
            <Badge variant="secondary" className={`text-[10px] ${statusBadgeClass(i.status)}`}>
              {ITEM_STATUS_LABEL[i.status] ?? i.status}
            </Badge>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={selected.length === 0}
          onClick={() => setMode("items")}
        >
          <XCircle className="mr-1 h-4 w-4" />
          Cancel selected ({selected.length})
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setMode("order")}>
          Cancel entire order
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "order" ? "Cancel entire order?" : "Cancel selected items?"}
            </DialogTitle>
            <DialogDescription>
              {mode === "order"
                ? "All items that are not yet confirmed will be cancelled. This cannot be undone."
                : `${selected.length} item(s) will be cancelled. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) — e.g. wrong size, want a different design"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={busy}>
              Keep order
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy}>
              {busy ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
