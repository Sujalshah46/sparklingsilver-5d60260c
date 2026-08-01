import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { BUYER_CANCELLABLE } from "./order-cancel";
import { qtyLimits, validateQty, MAX_ITEM_QTY } from "./order-qty";


const input = z.object({
  order_id: z.string().uuid(),
  /** New quantities for items the buyer changed. */
  quantities: z
    .array(z.object({ item_id: z.string().uuid(), quantity: z.number().int().min(1).max(999) }))
    .max(500)
    .optional(),
  /** Items the buyer removed from the order. */
  remove_ids: z.array(z.string().uuid()).max(500).optional(),
});

/**
 * Buyer-initiated edit of an un-confirmed order: change quantities and/or
 * remove SKUs. Only items still in a pre-confirmation status can be touched.
 * Ownership is verified with the user-scoped client; writes use the admin
 * client because buyers have no UPDATE policy on orders/order_items.
 */
export const editOwnOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_no, user_id, customer_name")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const { data: itemRows, error: itemsErr } = await supabase
      .from("order_items")
      .select(
        "id, status, quantity, unit_price, product_sku, product_name, product_id, product:products(id, moq, stock_quantity, in_stock)",
      )
      .eq("order_id", data.order_id);
    if (itemsErr) throw new Error(itemsErr.message);
    const items = (itemRows ?? []) as unknown as {
      id: string;
      status: string;
      quantity: number;
      unit_price: number | string;
      product_sku: string | null;
      product_name: string;
      product_id: string | null;
      product: {
        id: string;
        moq: number | null;
        stock_quantity: number | null;
        in_stock: boolean | null;
      } | null;
    }[];
    const byId = new Map(items.map((i) => [i.id, i]));
    const editable = new Set<string>(BUYER_CANCELLABLE as unknown as string[]);

    const removeIds = Array.from(new Set(data.remove_ids ?? []));
    const qtyChanges = (data.quantities ?? []).filter((q) => !removeIds.includes(q.item_id));

    for (const id of [...removeIds, ...qtyChanges.map((q) => q.item_id)]) {
      const it = byId.get(id);
      if (!it) throw new Error("An item does not belong to this order");
      if (!editable.has(it.status)) {
        throw new Error(
          "Some items are already confirmed and can no longer be edited. Please contact us on WhatsApp.",
        );
      }
    }

    // Server-authoritative quantity + stock validation.
    for (const q of qtyChanges) {
      const it = byId.get(q.item_id)!;
      if (it.quantity === q.quantity) continue;
      const label = it.product_sku || it.product_name;
      const limits = qtyLimits(it.product, it.quantity);
      const err = validateQty(q.quantity, limits, label);
      if (err) throw new Error(err);
      if (q.quantity > it.quantity && it.product && it.product.in_stock === false) {
        throw new Error(`${label} is out of stock — quantity cannot be increased.`);
      }
    }

    if (removeIds.length === 0 && qtyChanges.length === 0) {
      throw new Error("No changes to save");
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    for (const q of qtyChanges) {
      const it = byId.get(q.item_id)!;
      if (it.quantity === q.quantity) continue;
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({ quantity: q.quantity } as never)
        .eq("id", q.item_id);
      if (error) throw new Error(error.message);
      it.quantity = q.quantity;
    }

    if (removeIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({ status: "cancelled", status_updated_at: now } as never)
        .in("id", removeIds);
      if (error) throw new Error(error.message);

      await supabaseAdmin.from("item_status_history").insert(
        removeIds.map((id) => ({
          order_item_id: id,
          from_status: byId.get(id)!.status,
          to_status: "cancelled",
          changed_by: userId,
          note: "Removed by buyer while editing the order",
        })) as never,
      );
    }

    // Recompute server-authoritative totals from the surviving items.
    const alive = items.filter(
      (i) => !removeIds.includes(i.id) && i.status !== "cancelled" && i.status !== "rejected",
    );
    const subtotal =
      Math.round(alive.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0) * 100) / 100;
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;
    const orderCancelled = alive.length === 0;

    const { error: updOrderErr } = await supabaseAdmin
      .from("orders")
      .update({
        subtotal,
        gst,
        total,
        ...(orderCancelled ? { status: "cancelled", admin_notes: "Cancelled by buyer (edit)" } : {}),
      } as never)
      .eq("id", data.order_id);
    if (updOrderErr) throw new Error(updOrderErr.message);

    try {
      const { notifyAdmins } = await import("./push.server");
      const parts: string[] = [];
      if (qtyChanges.length) parts.push(`${qtyChanges.length} qty change(s)`);
      if (removeIds.length) parts.push(`${removeIds.length} item(s) removed`);
      notifyAdmins({
        title: orderCancelled ? "Order cancelled by buyer" : "Order edited by buyer",
        body: `${order.customer_name ?? ""} · ${order.order_no} · ${parts.join(", ")}`,
        url: `/admin/orders/${data.order_id}`,
        tag: `order-edit-${data.order_id}`,
      }).catch(() => {});
    } catch {
      /* non-fatal */
    }

    return {
      updated: qtyChanges.length,
      removed: removeIds.length,
      orderCancelled,
      total,
    };
  });
