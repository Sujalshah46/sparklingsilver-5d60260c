import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./shipments.server";

const input = z.object({
  order_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(999).optional(),
        gross_weight: z.number().min(0).max(100000).nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Admin-side correction of an order line: quantity and/or gross weight.
 * Allowed at any stage. Order totals are recomputed server-side and the buyer
 * is notified so their order screen reflects the change.
 */
export const adjustOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_no, user_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) throw new Error("Order not found");

    const { data: rows, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, quantity, gross_weight, unit_price, status, product_sku, product_name")
      .eq("order_id", data.order_id);
    if (itemsErr) throw new Error(itemsErr.message);
    const items = (rows ?? []) as unknown as {
      id: string;
      quantity: number;
      gross_weight: number | string | null;
      unit_price: number | string;
      status: string;
      product_sku: string | null;
      product_name: string;
    }[];
    const byId = new Map(items.map((i) => [i.id, i]));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const changes: string[] = [];

    for (const patch of data.items) {
      const it = byId.get(patch.item_id);
      if (!it) throw new Error("An item does not belong to this order");

      const update: Record<string, unknown> = {};
      const label = it.product_sku || it.product_name;

      if (patch.quantity != null && patch.quantity !== it.quantity) {
        update.quantity = patch.quantity;
        changes.push(`${label}: qty ${it.quantity} → ${patch.quantity}`);
        it.quantity = patch.quantity;
      }
      if (patch.gross_weight !== undefined) {
        const before = it.gross_weight == null ? null : Number(it.gross_weight);
        const after = patch.gross_weight;
        if (before !== after) {
          update.gross_weight = after;
          changes.push(
            `${label}: gross ${before == null ? "—" : before.toFixed(3)} → ${
              after == null ? "—" : after.toFixed(3)
            } g`,
          );
          it.gross_weight = after;
        }
      }

      if (Object.keys(update).length === 0) continue;
      const { error } = await supabaseAdmin
        .from("order_items")
        .update(update as never)
        .eq("id", patch.item_id);
      if (error) throw new Error(error.message);
    }

    if (changes.length === 0) return { updated: 0, total: null as number | null, changes };

    // Recompute server-authoritative totals from the surviving items.
    const alive = items.filter((i) => i.status !== "cancelled" && i.status !== "rejected");
    const subtotal =
      Math.round(alive.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0) * 100) / 100;
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const { error: updOrderErr } = await supabaseAdmin
      .from("orders")
      .update({ subtotal, gst, total } as never)
      .eq("id", data.order_id);
    if (updOrderErr) throw new Error(updOrderErr.message);

    if (order.user_id) {
      try {
        const { notifyUser } = await import("./push.server");
        await notifyUser(order.user_id as string, {
          title: "Order updated",
          body: `Order ${order.order_no}: ${changes.slice(0, 3).join("; ")}${
            changes.length > 3 ? "…" : ""
          }`,
          url: `/orders/${data.order_id}`,
          tag: `order-adjust-${data.order_id}`,
        });
      } catch {
        /* non-fatal */
      }
    }

    return { updated: changes.length, total, changes };
  });
