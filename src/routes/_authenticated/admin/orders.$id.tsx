import { pageTitle } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { formatDate } from "@/lib/format";
import { categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Check,
  X,
  ArrowLeft,
  Truck,
  PackageCheck,
  ClipboardCheck,
  Package,
  Bike,
  Ban,
  Pencil,
} from "lucide-react";
import { updateOrderStatus } from "@/lib/admin.functions";
import { moveItemsForward, cancelOrderItems } from "@/lib/shipments.functions";
import { adjustOrderItems } from "@/lib/order-items-admin.functions";
import { OrderStageTracker, type OrderStatus } from "@/components/admin/OrderStageTracker";
import { nextStatus, rollupStatus, STATUS_LABEL, canSplitFrom, isActive, statusBadgeClass } from "@/lib/order-rollup";


export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Order") }] }),
  component: AdminOrderDetail,
});

type ItemRow = {
  id: string;
  product_name: string;
  product_sku: string | null;
  image_url: string | null;
  quantity: number;
  size: string | null;
  gross_weight: number | string | null;
  remark: string | null;
  status: string;
  shipment_id: string | null;
};

type ShipmentRow = {
  id: string;
  status: string;
  tracking_number: string | null;
  courier: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
};


const STAGE_ICON: Record<string, typeof Package> = {
  processing: Package,
  dispatched: Truck,
  out_for_delivery: Bike,
  delivered: PackageCheck,
};

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [tracking, setTracking] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editGross, setEditGross] = useState("");
  const update = useServerFn(updateOrderStatus);
  const move = useServerFn(moveItemsForward);
  const cancelItems = useServerFn(cancelOrderItems);
  const adjust = useServerFn(adjustOrderItems);


  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), shipments(*)")
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  useEffect(() => {
    if (order?.admin_notes) setNotes(order.admin_notes);
  }, [order?.admin_notes]);
  useEffect(() => {
    if (order?.tracking_number) setTracking(order.tracking_number);
  }, [order?.tracking_number]);

  const items = useMemo(() => (order?.order_items ?? []) as unknown as ItemRow[], [order]);
  const shipments = useMemo(
    () =>
      ((order?.shipments ?? []) as unknown as ShipmentRow[])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [order],
  );
  const rollup = useMemo(
    () =>
      rollupStatus(
        items.map((i) => i.status),
        (order?.status as string) ?? "pending",
      ),
    [items, order?.status],
  );

  const selectedRows = items.filter((i) => selected.includes(i.id));
  const selectedStatuses = Array.from(new Set(selectedRows.map((i) => i.status)));
  const mixed = selectedStatuses.length > 1;
  const target = !mixed && selectedStatuses[0] ? nextStatus(selectedStatuses[0]) : null;
  const totalGrams = items
    .filter((i) => isActive(i.status))
    .reduce((s, i) => s + Number(i.gross_weight ?? 0) * (i.quantity ?? 1), 0);

  const mutate = useMutation({
    mutationFn: async (status: OrderStatus) =>
      update({
        data: {
          order_id: id,
          status,
          admin_notes: notes || null,
          tracking_number: tracking || null,
        },
      }),
    onSuccess: (_d, status) => {
      toast.success(`Order ${status.replace(/_/g, " ")}`);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const moveMut = useMutation({
    mutationFn: async () =>
      move({
        data: {
          order_id: id,
          item_ids: selected,
          to_status: target as "processing" | "dispatched" | "out_for_delivery" | "delivered",
          tracking_number: tracking || null,
        },
      }),
    onSuccess: () => {
      toast.success(
        `${selected.length} item${selected.length > 1 ? "s" : ""} moved to ${STATUS_LABEL[target!]}`,
      );
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Move failed"),
  });

  const cancelMut = useMutation({
    mutationFn: async () => cancelItems({ data: { order_id: id, item_ids: selected } }),
    onSuccess: () => {
      toast.success("Item(s) cancelled");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Cancel failed"),
  });

  const adjustMut = useMutation({
    mutationFn: async (vars: { item_id: string; quantity: number; gross_weight: number | null }) =>
      adjust({
        data: {
          order_id: id,
          items: [
            {
              item_id: vars.item_id,
              quantity: vars.quantity,
              gross_weight: vars.gross_weight,
            },
          ],
        },
      }),
    onSuccess: (res) => {
      toast.success(res?.updated ? "Item updated" : "No changes");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const startEdit = (it: ItemRow) => {
    setEditingId(it.id);
    setEditQty(String(it.quantity ?? 1));
    setEditGross(it.gross_weight == null ? "" : String(Number(it.gross_weight)));
  };

  const saveEdit = (it: ItemRow) => {
    const q = Math.floor(Number(editQty));
    if (!Number.isFinite(q) || q < 1 || q > 999) {
      toast.error("Quantity must be between 1 and 999");
      return;
    }
    const g = editGross.trim() === "" ? null : Number(editGross);
    if (g !== null && (!Number.isFinite(g) || g < 0)) {
      toast.error("Gross weight must be a positive number");
      return;
    }
    adjustMut.mutate({ item_id: it.id, quantity: q, gross_weight: g });
  };


  if (isLoading)
    return (
      <MobileShell title="Order">
        <p className="p-8 text-center text-muted-foreground">Loading…</p>
      </MobileShell>
    );
  if (!order)
    return (
      <MobileShell title="Order">
        <p className="p-8 text-center text-muted-foreground">Not found</p>
      </MobileShell>
    );

  const splittable = canSplitFrom(rollup.status) && rollup.status !== "delivered";
  const MoveIcon = target ? (STAGE_ICON[target] ?? Package) : Package;

  return (
    <MobileShell title={order.order_no}>
      <div className="space-y-4 p-4 pb-28">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-sm text-burgundy"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </button>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-lg font-semibold">{order.order_no}</p>
              <p className="text-xs text-muted-foreground">Placed {formatDate(order.created_at)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={`capitalize ${statusBadgeClass(rollup.status)}`}>{rollup.label}</Badge>
              {rollup.split && (
                <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-charcoal">
                  Split
                </span>
              )}
            </div>
          </div>
          <OrderStageTracker
            status={rollup.status as OrderStatus}
            history={(order as { stage_history?: unknown }).stage_history}
            counts={rollup.counts}
            totalItems={rollup.total}
          />
        </div>

        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-serif text-base font-semibold">Customer</h3>
          <p className="font-semibold">{order.customer_name}</p>
          <p className="text-muted-foreground">
            <a className="text-burgundy" href={`tel:${order.customer_phone}`}>
              {order.customer_phone}
            </a>
            {" · "}
            <a className="text-burgundy" href={`mailto:${order.customer_email}`}>
              {order.customer_email}
            </a>
          </p>
          <p className="mt-1 text-muted-foreground">
            {order.customer_address}, {order.customer_city} {order.customer_pincode}
          </p>
          {order.customer_notes && (
            <p className="mt-2 rounded-md bg-secondary p-2 text-xs">
              <span className="font-semibold">Note: </span>
              {order.customer_notes}
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-base font-semibold">Items</h3>
            {splittable && items.length > 1 && (
              <button
                type="button"
                className="text-xs text-burgundy"
                onClick={() =>
                  setSelected(
                    selected.length === items.filter((i) => isActive(i.status)).length
                      ? []
                      : items.filter((i) => isActive(i.status)).map((i) => i.id),
                  )
                }
              >
                {selected.length ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {items.map((it) => {
              const selectable = splittable && isActive(it.status);
              return (
                <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  {selectable && (
                    <Checkbox
                      className="mt-1"
                      checked={selected.includes(it.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) =>
                          v ? [...prev, it.id] : prev.filter((x) => x !== it.id),
                        )
                      }
                      aria-label={`Select ${it.product_name}`}
                    />
                  )}
                  <img
                    src={resolveProductImage(it.image_url, categoryPlaceholder)}
                    alt={it.product_name}
                    width={64}
                    height={64}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallback === "1") {
                        img.style.visibility = "hidden";
                        return;
                      }
                      img.dataset.fallback = "1";
                      img.src = categoryPlaceholder;
                    }}
                    className="h-16 w-16 rounded-lg bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-serif text-sm font-semibold">
                      {it.product_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <p className="text-[11px] text-muted-foreground">
                        SKU {it.product_sku} · Qty {it.quantity}
                        {it.size ? ` · Size ${it.size}` : ""}
                      </p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(it.status)}`}
                      >
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#555]">
                      <span className="font-semibold text-[#333]">Gross:</span>{" "}
                      {Number(it.gross_weight ?? 0).toFixed(3)} g
                    </p>
                    {it.remark && (
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary p-2 text-[11px]">
                        <span className="font-semibold">Item Remarks: </span>
                        {it.remark}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-right text-xs font-semibold">
            Total (g): {totalGrams.toFixed(3)}
          </p>
        </section>

        {shipments.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-serif text-base font-semibold">Shipment history</h3>
            <ol className="space-y-3">
              {shipments.map((sh, i) => {
                const shipItems = items.filter((it) => it.shipment_id === sh.id);
                const grams = shipItems.reduce(
                  (s, it) => s + Number(it.gross_weight ?? 0) * (it.quantity ?? 1),
                  0,
                );
                return (
                  <li key={sh.id} className="rounded-lg border border-border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Shipment {i + 1}</p>
                      <Badge className={statusBadgeClass(sh.status)}>
                        {STATUS_LABEL[sh.status] ?? sh.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {shipItems.length
                        ? shipItems.map((it) => it.product_sku || it.product_name).join(", ")
                        : "No items currently assigned"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Total (g): {grams.toFixed(3)}
                      {sh.dispatched_at ? ` · Dispatched ${formatDate(sh.dispatched_at)}` : ""}
                      {sh.delivered_at ? ` · Delivered ${formatDate(sh.delivered_at)}` : ""}
                    </p>
                    {sh.tracking_number && (
                      <p className="mt-1 font-mono text-[11px]">Tracking #{sh.tracking_number}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

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
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Internal notes (visible to admins only)"
          />
        </section>

        <section className="space-y-2">
          {order.status === "pending" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={mutate.isPending}
                onClick={() => mutate.mutate("accepted")}
                className="bg-green-700 hover:bg-green-800"
              >
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button
                disabled={mutate.isPending}
                variant="destructive"
                onClick={() => mutate.mutate("rejected")}
              >
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          )}
          {order.status === "accepted" && (
            <Button
              disabled={mutate.isPending}
              onClick={() => mutate.mutate("confirmed")}
              className="w-full bg-burgundy hover:bg-burgundy/90"
            >
              <ClipboardCheck className="mr-1 h-4 w-4" /> Confirm Order
            </Button>
          )}
          {splittable && (
            <p className="text-center text-[11px] text-muted-foreground">
              Select items above to move them forward as a batch.
            </p>
          )}
          {(
            ["accepted", "confirmed", "processing", "dispatched", "out_for_delivery"] as string[]
          ).includes(order.status) && (
            <Button
              disabled={mutate.isPending}
              variant="outline"
              onClick={() => mutate.mutate("cancelled")}
              className="w-full"
            >
              Cancel whole order
            </Button>
          )}
        </section>
      </div>

      {selected.length > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 p-3 backdrop-blur">
          <p className="mb-2 text-xs text-muted-foreground">
            {selected.length} item{selected.length > 1 ? "s" : ""} selected
            {mixed && " · Select items at the same stage to move them together."}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-burgundy hover:bg-burgundy/90"
              disabled={
                mixed ||
                !target ||
                moveMut.isPending ||
                (target === "out_for_delivery" && !tracking.trim())
              }
              title={
                mixed
                  ? "Select items at the same stage to move them together."
                  : target === "out_for_delivery" && !tracking.trim()
                    ? "Enter tracking / AWB first"
                    : undefined
              }
              onClick={() => moveMut.mutate()}
            >
              <MoveIcon className="mr-1 h-4 w-4" />
              {target ? `Move selected to ${STATUS_LABEL[target]}` : "No further stage"}
            </Button>
            <Button
              variant="outline"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              <Ban className="mr-1 h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
