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
import { editOwnOrder } from "@/lib/order-edit.functions";
import { BUYER_CANCELLABLE } from "@/lib/order-cancel";
import { qtyLimits, clampQty, validateQty } from "@/lib/order-qty";


import { toast } from "sonner";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Pencil,
  Plus,
  Minus,
  Trash2,
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
        .select(
          "*, order_items(*, item_status_history(*), product:products(id, moq, stock_quantity, in_stock)), shipments(*)",
        )

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
          <EditOrderPanel
            orderId={id}
            items={allItems.map((i) => ({
              id: i.id,
              status: i.status ?? status,
              label: i.product_sku || i.product_name,
              name: i.product_name,
              quantity: i.quantity,
              image_url: i.image_url,
              product: i.product ?? null,

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

type ProductLimits = {
  id: string;
  moq: number | null;
  stock_quantity: number | null;
  in_stock: boolean | null;
};

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
  product?: ProductLimits | null;
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

type EditItem = {
  id: string;
  status: string;
  label: string;
  name: string;
  quantity: number;
  image_url: string | null;
  product: ProductLimits | null;
};


const CANCELLABLE = new Set<string>(BUYER_CANCELLABLE as unknown as string[]);

/**
 * Simple buyer-side "Edit order": change quantity or remove a SKU while the
 * order is still un-confirmed. Removing every SKU cancels the order.
 */
function EditOrderPanel({ orderId, items }: { orderId: string; items: EditItem[] }) {
  const qc = useQueryClient();
  const editFn = useServerFn(editOwnOrder);
  const editable = items.filter((i) => CANCELLABLE.has(i.status));

  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkQty, setBulkQty] = useState("");
  const [busy, setBusy] = useState(false);

  if (editable.length === 0) return null;

  const start = () => {
    setQty(Object.fromEntries(editable.map((i) => [i.id, i.quantity])));
    setRemoved([]);
    setSelected([]);
    setBulkQty("");
    setOpen(true);
  };

  const kept = editable.filter((i) => !removed.includes(i.id));
  const allSelected = kept.length > 0 && kept.every((i) => selected.includes(i.id));
  const changed =
    removed.length > 0 || editable.some((i) => (qty[i.id] ?? i.quantity) !== i.quantity);

  /** Apply one quantity to every ticked SKU, clamped to each SKU's own limits. */
  const applyBulkQty = () => {
    const n = parseInt(bulkQty, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a quantity of at least 1.");
      return;
    }
    const targets = kept.filter((i) => selected.includes(i.id));
    if (targets.length === 0) return;
    setQty((s) => {
      const next = { ...s };
      for (const i of targets) next[i.id] = clampQty(n, qtyLimits(i.product, i.quantity));
      return next;
    });
    toast.success(`Quantity updated for ${targets.length} SKU${targets.length > 1 ? "s" : ""}.`);
  };


  const errorFor = (i: EditItem) => {
    const limits = qtyLimits(i.product, i.quantity);
    const q = qty[i.id] ?? i.quantity;
    if (q > i.quantity && i.product?.in_stock === false)
      return `${i.label} is out of stock — quantity cannot be increased.`;
    return validateQty(q, limits, i.label);
  };
  const errors = kept.map(errorFor).filter((e): e is string => !!e);

  const save = async () => {
    if (errors.length > 0) {
      toast.error(errors[0]!);
      return;
    }
    setBusy(true);
    try {

      const res = await editFn({
        data: {
          order_id: orderId,
          quantities: editable
            .filter((i) => !removed.includes(i.id))
            .map((i) => ({ item_id: i.id, quantity: qty[i.id] ?? i.quantity })),
          remove_ids: removed,
        },
      });
      toast.success(
        res.orderCancelled ? "Your order has been cancelled." : "Your order has been updated.",
      );
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["order", orderId] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="font-serif text-base font-semibold">Need changes?</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Change quantity or remove items until we confirm your order.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={start} data-testid="edit-order">
        <Pencil className="mr-1 h-4 w-4" /> Edit order
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit order</DialogTitle>
            <DialogDescription>
              Adjust quantity or remove a SKU. Removing everything cancels the order.
            </DialogDescription>
          </DialogHeader>

          {editable.length > 1 && (
            <div className="rounded-lg border border-border bg-secondary/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] font-semibold">
                  <Checkbox
                    checked={allSelected}
                    aria-label="Select all SKUs"
                    onCheckedChange={(c) =>
                      setSelected(c === true ? kept.map((i) => i.id) : [])
                    }
                  />
                  {selected.length > 0 ? `${selected.length} selected` : "Select all"}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_ITEM_QTY}
                    placeholder="Qty"
                    value={bulkQty}
                    aria-label="Bulk quantity"
                    onChange={(e) => setBulkQty(e.target.value)}
                    className="h-7 w-16 rounded-md border border-border bg-background text-center text-sm font-semibold"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={selected.length === 0 || !bulkQty}
                    onClick={applyBulkQty}
                  >
                    Apply
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    aria-label="Remove selected SKUs"
                    disabled={selected.length === 0}
                    onClick={() => {
                      setRemoved((r) => [...new Set([...r, ...selected])]);
                      setSelected([]);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Bulk update: tick SKUs, enter a quantity and tap Apply (each SKU stays within its
                own min / stock limits).
              </p>
            </div>
          )}



          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {editable.map((i) => {
              const gone = removed.includes(i.id);
              const limits = qtyLimits(i.product, i.quantity);
              const q = qty[i.id] ?? i.quantity;
              const err = gone ? null : errorFor(i);
              const outOfStock = i.product?.in_stock === false;
              const setQ = (n: number) =>
                setQty((s) => ({ ...s, [i.id]: clampQty(n, limits) }));
              return (
                <div
                  key={i.id}
                  className={`rounded-lg border p-2 ${gone ? "border-border opacity-50" : err ? "border-destructive" : "border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selected.includes(i.id)}
                      disabled={gone}
                      aria-label={`Select ${i.label}`}
                      onCheckedChange={(c) =>
                        setSelected((s) =>
                          c === true ? [...new Set([...s, i.id])] : s.filter((x) => x !== i.id),
                        )
                      }
                    />
                    <img

                      src={resolveProductImage(i.image_url)}
                      alt={i.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${gone ? "line-through" : ""}`}>
                        {i.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">SKU {i.label}</p>
                    </div>

                    {gone ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoved((r) => r.filter((x) => x !== i.id))}
                      >
                        Undo
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            aria-label={`Decrease quantity for ${i.label}`}
                            disabled={q <= limits.min}
                            onClick={() => setQ(q - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={limits.min}
                            max={limits.max}
                            value={q}
                            aria-label={`Quantity for ${i.label}`}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              setQty((s) => ({
                                ...s,
                                [i.id]: Number.isNaN(n) ? limits.min : n,
                              }));
                            }}
                            onBlur={() => setQ(q)}
                            className="h-7 w-12 rounded-md border border-border bg-background text-center text-sm font-semibold"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            aria-label={`Increase quantity for ${i.label}`}
                            disabled={q >= limits.max || outOfStock}
                            onClick={() => setQ(q + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          aria-label={`Remove ${i.label}`}
                          onClick={() => setRemoved((r) => [...r, i.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {!gone && (err || limits.min > 1 || limits.stockCapped || outOfStock) && (
                    <p
                      className={`mt-1 pl-[52px] text-[11px] ${err ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {err ??
                        [
                          outOfStock ? "Out of stock" : null,
                          limits.min > 1 ? `Min ${limits.min} pcs` : null,
                          limits.stockCapped ? `Max ${limits.max} pcs available` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button onClick={save} disabled={busy || !changed || errors.length > 0}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </section>
  );
}

