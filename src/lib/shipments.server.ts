import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTransition, isActive, STATUS_LABEL, type ItemStatus } from "./order-rollup";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, any, any>;

export async function assertAdmin(supabase: DB, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export interface ItemRow {
  id: string;
  order_id: string;
  status: string;
  shipment_id: string | null;
  product_sku: string | null;
  product_name: string;
}

export async function loadOrderItems(supabase: DB, orderId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, status, shipment_id, product_sku, product_name")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

/** Validate a bulk move and return the selected rows. */
export function validateMove(all: ItemRow[], itemIds: string[], to: ItemStatus): ItemRow[] {
  const byId = new Map(all.map((i) => [i.id, i]));
  const selected = itemIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error("An item does not belong to this order");
    return row;
  });
  if (selected.length === 0) throw new Error("Select at least one item");

  const froms = Array.from(new Set(selected.map((s) => s.status)));
  if (froms.length > 1) throw new Error("Select items at the same stage to move them together.");
  const from = froms[0];
  if (!isActive(from)) throw new Error("Cancelled items cannot be moved");
  if (!isValidTransition(from, to)) {
    throw new Error(`Cannot move from ${STATUS_LABEL[from] ?? from} to ${STATUS_LABEL[to] ?? to}`);
  }
  return selected;
}

/**
 * Recompute the order's rollup column: the order sits at the LEAST progressed
 * active item stage, so it never reads "Delivered" while items are outstanding.
 */
export async function syncOrderStatus(supabase: DB, orderId: string) {
  const items = await loadOrderItems(supabase, orderId);
  const active = items.filter((i) => isActive(i.status));
  if (active.length === 0) return;
  const { PIPELINE } = await import("./order-rollup");
  const least = active
    .map((i) => i.status)
    .sort((a, b) => PIPELINE.indexOf(a as ItemStatus) - PIPELINE.indexOf(b as ItemStatus))[0];
  await supabase.from("orders").update({ status: least } as never).eq("id", orderId);
}

export async function recordHistory(
  supabase: DB,
  rows: { order_item_id: string; from_status: string; to_status: string; note?: string | null }[],
  userId: string,
) {
  if (rows.length === 0) return;
  await supabase.from("item_status_history").insert(
    rows.map((r) => ({
      order_item_id: r.order_item_id,
      from_status: r.from_status,
      to_status: r.to_status,
      changed_by: userId,
      note: r.note ?? null,
    })) as never,
  );
}

/** Per-shipment push notification to the buyer. */
export async function notifyShipment(opts: {
  supabase: DB;
  orderId: string;
  status: ItemStatus;
  items: ItemRow[];
  shipmentIndex: number;
  shipmentTotal: number;
  tracking?: string | null;
}) {
  const { supabase, orderId, status, items, shipmentIndex, shipmentTotal, tracking } = opts;
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.user_id) return;

  const skus = items.map((i) => i.product_sku || i.product_name).join(", ");
  const label = STATUS_LABEL[status] ?? status;
  const prefix = shipmentTotal > 1 ? `Shipment ${shipmentIndex} of ${shipmentTotal} · ` : "";
  try {
    const { notifyUser } = await import("./push.server");
    await notifyUser(order.user_id as string, {
      title: `${prefix}${label}`,
      body: `Order ${order.order_no}: ${skus} — ${label}${tracking ? ` (Tracking: ${tracking})` : ""}.`,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}-ship${shipmentIndex}-${status}`,
    });
  } catch (e) {
    console.error("[notifyShipment] failed", e);
  }
}
