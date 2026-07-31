import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { BUYER_CANCELLABLE } from "./order-cancel";

const input = z.object({
  order_id: z.string().uuid(),
  /** Omit / empty => cancel every still-cancellable item (whole order). */
  item_ids: z.array(z.string().uuid()).max(500).optional(),
  reason: z.string().trim().max(500).optional().nullable(),
});

/**
 * Buyer-initiated cancellation of selected SKUs or the whole order.
 * Allowed only while the items are still pre-confirmation (pending/accepted).
 * Writes go through the admin client because buyers have no UPDATE policy on
 * orders/order_items — ownership is verified first with the user-scoped client.
 */
export const cancelOwnOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check with the user-scoped client (RLS enforced).
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_no, user_id, customer_name")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const { data: itemRows, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, status, product_sku, product_name")
      .eq("order_id", data.order_id);
    if (itemsErr) throw new Error(itemsErr.message);
    const items = (itemRows ?? []) as {
      id: string;
      status: string;
      product_sku: string | null;
      product_name: string;
    }[];

    const cancellable = new Set<string>(BUYER_CANCELLABLE as unknown as string[]);
    const requested = data.item_ids?.length
      ? items.filter((i) => data.item_ids!.includes(i.id))
      : items.filter((i) => cancellable.has(i.status));

    if (data.item_ids?.length && requested.length !== data.item_ids.length) {
      throw new Error("An item does not belong to this order");
    }
    const blocked = requested.filter((i) => !cancellable.has(i.status));
    if (blocked.length > 0) {
      throw new Error(
        "These items are already confirmed and can no longer be cancelled. Please contact us on WhatsApp.",
      );
    }
    if (requested.length === 0) {
      throw new Error("Nothing left to cancel — these items are already confirmed or cancelled.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = requested.map((i) => i.id);
    const now = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from("order_items")
      .update({ status: "cancelled", status_updated_at: now } as never)
      .in("id", ids);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("item_status_history").insert(
      requested.map((i) => ({
        order_item_id: i.id,
        from_status: i.status,
        to_status: "cancelled",
        changed_by: userId,
        note: data.reason ? `Cancelled by buyer: ${data.reason}` : "Cancelled by buyer",
      })) as never,
    );

    // If nothing active remains, the order itself is cancelled.
    const remaining = items.filter(
      (i) => !ids.includes(i.id) && i.status !== "cancelled" && i.status !== "rejected",
    );
    const orderCancelled = remaining.length === 0;
    if (orderCancelled) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "cancelled",
          admin_notes: data.reason ? `Cancelled by buyer: ${data.reason}` : "Cancelled by buyer",
        } as never)
        .eq("id", data.order_id);
    }

    try {
      const { notifyAdmins } = await import("./push.server");
      const labels = requested.map((i) => i.product_sku || i.product_name).join(", ");
      notifyAdmins({
        title: orderCancelled ? "Order cancelled by buyer" : "Items cancelled by buyer",
        body: `${order.customer_name ?? ""} · ${order.order_no} · ${labels}`,
        url: `/admin/orders/${data.order_id}`,
        tag: `order-cancel-${data.order_id}`,
      }).catch(() => {});
    } catch {
      /* non-fatal */
    }

    return { cancelled: ids.length, orderCancelled };
  });
