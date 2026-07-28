import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAdmin,
  loadOrderItems,
  validateMove,
  recordHistory,
  syncOrderStatus,
  notifyShipment,
} from "./shipments.server";
import type { ItemStatus } from "./order-rollup";

const moveInput = z.object({
  order_id: z.string().uuid(),
  item_ids: z.array(z.string().uuid()).min(1).max(200),
  to_status: z.enum(["processing", "dispatched", "out_for_delivery", "delivered"]),
  tracking_number: z.string().trim().max(120).optional().nullable(),
  courier: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Move a subset of an order's items forward one stage, batching them into a
 * shipment. Items entering "processing" start a new shipment; later stages
 * advance their existing shipment (splitting it if only part of it moves).
 */
export const moveItemsForward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => moveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const all = await loadOrderItems(supabase, data.order_id);
    const selected = validateMove(all, data.item_ids, data.to_status as ItemStatus);
    const from = selected[0].status;

    let shipmentId: string | null = null;

    if (data.to_status === "processing") {
      const { data: ship, error } = await supabase
        .from("shipments")
        .insert({
          order_id: data.order_id,
          status: "processing",
          tracking_number: data.tracking_number ?? null,
          courier: data.courier ?? null,
          created_by: userId,
        } as never)
        .select("id")
        .single();
      if (error || !ship) throw new Error(error?.message ?? "Could not create shipment");
      shipmentId = ship.id as string;
    } else {
      const ids = Array.from(new Set(selected.map((s) => s.shipment_id)));
      if (ids.length > 1 || !ids[0]) {
        throw new Error("Select items from the same shipment to move them together.");
      }
      const currentShipment = ids[0];
      const siblings = all.filter((i) => i.shipment_id === currentShipment);
      const movingAll = siblings.every((s) => data.item_ids.includes(s.id));

      if (movingAll) {
        shipmentId = currentShipment;
      } else {
        // Partial move out of an existing shipment -> split into a new batch.
        const { data: src } = await supabase
          .from("shipments")
          .select("tracking_number, courier")
          .eq("id", currentShipment)
          .maybeSingle();
        const { data: ship, error } = await supabase
          .from("shipments")
          .insert({
            order_id: data.order_id,
            status: data.to_status,
            tracking_number: data.tracking_number ?? src?.tracking_number ?? null,
            courier: data.courier ?? src?.courier ?? null,
            created_by: userId,
          } as never)
          .select("id")
          .single();
        if (error || !ship) throw new Error(error?.message ?? "Could not split shipment");
        shipmentId = ship.id as string;
      }

      const patch: Record<string, unknown> = { status: data.to_status };
      if (data.tracking_number !== undefined && data.tracking_number !== null) patch.tracking_number = data.tracking_number;
      if (data.courier !== undefined && data.courier !== null) patch.courier = data.courier;
      if (data.to_status === "dispatched") patch.dispatched_at = new Date().toISOString();
      if (data.to_status === "delivered") patch.delivered_at = new Date().toISOString();
      const { error: upErr } = await supabase.from("shipments").update(patch as never).eq("id", shipmentId);
      if (upErr) throw new Error(upErr.message);
    }

    const { error: itemErr } = await supabase
      .from("order_items")
      .update({
        status: data.to_status,
        status_updated_at: new Date().toISOString(),
        shipment_id: shipmentId,
      } as never)
      .in("id", data.item_ids);
    if (itemErr) throw new Error(itemErr.message);

    await recordHistory(
      supabase,
      selected.map((s) => ({ order_item_id: s.id, from_status: from, to_status: data.to_status, note: data.note })),
      userId,
    );
    await syncOrderStatus(supabase, data.order_id);

    const { data: ships } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", data.order_id)
      .order("created_at", { ascending: true });
    const list = (ships ?? []) as { id: string }[];
    notifyShipment({
      supabase,
      orderId: data.order_id,
      status: data.to_status as ItemStatus,
      items: selected,
      shipmentIndex: Math.max(1, list.findIndex((s) => s.id === shipmentId) + 1),
      shipmentTotal: list.length,
      tracking: data.tracking_number ?? null,
    }).catch(() => {});

    return { ok: true, shipment_id: shipmentId };
  });

const cancelInput = z.object({
  order_id: z.string().uuid(),
  item_ids: z.array(z.string().uuid()).min(1).max(200),
  note: z.string().trim().max(500).optional().nullable(),
});

/** Cancel individual items without touching the rest of the order. */
export const cancelOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const all = await loadOrderItems(supabase, data.order_id);
    const selected = all.filter((i) => data.item_ids.includes(i.id));
    if (selected.length !== data.item_ids.length) throw new Error("An item does not belong to this order");

    const { error } = await supabase
      .from("order_items")
      .update({ status: "cancelled", status_updated_at: new Date().toISOString(), shipment_id: null } as never)
      .in("id", data.item_ids);
    if (error) throw new Error(error.message);

    await recordHistory(
      supabase,
      selected.map((s) => ({ order_item_id: s.id, from_status: s.status, to_status: "cancelled", note: data.note })),
      userId,
    );
    await syncOrderStatus(supabase, data.order_id);
    return { ok: true };
  });

const shipmentInput = z.object({
  shipment_id: z.string().uuid(),
  tracking_number: z.string().trim().max(120).optional().nullable(),
  courier: z.string().trim().max(120).optional().nullable(),
});

/** Attach / edit tracking details on a shipment. */
export const updateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => shipmentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("shipments")
      .update({
        tracking_number: data.tracking_number ?? null,
        courier: data.courier ?? null,
      } as never)
      .eq("id", data.shipment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
