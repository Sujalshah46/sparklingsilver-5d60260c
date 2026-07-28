import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Code-level guard: WhatsApp deep-link handling MUST NOT be reachable from
 * any admin order status-update path. WhatsApp is a one-time, user-initiated
 * CTA on the Order Placed screen only — never a per-stage notification.
 * This module deliberately does not import from "@/lib/site" (whatsappUrl,
 * WHATSAPP_NUMBER). The ESLint `no-restricted-imports` rule for this file
 * enforces this at build time; the runtime assertion below is defense in
 * depth in case the lint rule is ever bypassed.
 */
function assertNoWhatsAppNotifier(payload: unknown): void {
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload as Record<string, unknown>).join(",").toLowerCase();
    if (keys.includes("whatsapp") || keys.includes("wa_")) {
      throw new Error(
        "Admin status update rejected: WhatsApp notification channel is not permitted on status transitions.",
      );
    }
  }
}

const ORDER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "processing",
  "ready",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

const statusInput = z.object({
  order_id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  admin_notes: z.string().trim().max(2000).optional().nullable(),
  tracking_number: z.string().trim().max(120).optional().nullable(),
});

async function ensureAdmin(supabase: unknown, userId: string) {
  const s = supabase as { from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } };
  const { data } = await s.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const CLIENT_MSG: Record<string, { title: string; body: (o: { order_no: string; tracking?: string | null }) => string }> = {
  confirmed:        { title: "Order confirmed",       body: (o) => `Order ${o.order_no} has been confirmed. We'll start processing it shortly.` },
  processing:       { title: "Order processing",      body: (o) => `Order ${o.order_no} is being picked & packed.` },
  dispatched:       { title: "Order dispatched",      body: (o) => `Order ${o.order_no} has been dispatched${o.tracking ? ` (Tracking: ${o.tracking})` : ""}.` },
  out_for_delivery: { title: "Out for delivery",      body: (o) => `Order ${o.order_no} is out for delivery today.` },
  delivered:        { title: "Order delivered",       body: (o) => `Order ${o.order_no} has been delivered. Thank you!` },
  rejected:         { title: "Order rejected",        body: (o) => `Order ${o.order_no} could not be accepted. Please check your order for details.` },
  cancelled:        { title: "Order cancelled",       body: (o) => `Order ${o.order_no} has been cancelled.` },
  accepted:         { title: "Order accepted",        body: (o) => `Order ${o.order_no} has been accepted and is under review.` },
};

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusInput.parse(d))
  .handler(async ({ data, context }) => {
    assertNoWhatsAppNotifier(data);
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const patch = {
      status: data.status,
      admin_notes: data.admin_notes ?? null,
      ...(data.tracking_number !== undefined ? { tracking_number: data.tracking_number ?? null } : {}),
    } satisfies Record<string, unknown>;

    const { data: updated, error } = await supabase
      .from("orders")
      .update(patch as never)
      .eq("id", data.order_id)
      .select("id, order_no, user_id, tracking_number")
      .single();
    if (error) throw new Error(error.message);

    // Order-level transitions keep every active line item in lock-step, so
    // item-level (split) fulfillment starts from a consistent baseline.
    const { error: itemErr } = await supabase
      .from("order_items")
      .update({ status: data.status, status_updated_at: new Date().toISOString() } as never)
      .eq("order_id", data.order_id)
      .not("status", "in", "(cancelled,rejected)");
    if (itemErr) console.error("[updateOrderStatus] item sync failed", itemErr);

    const msg = CLIENT_MSG[data.status];
    if (msg && updated?.user_id) {
      try {
        const { notifyUser } = await import("./push.server");
        notifyUser(updated.user_id as string, {
          title: msg.title,
          body: msg.body({ order_no: updated.order_no as string, tracking: updated.tracking_number as string | null }),
          url: `/orders/${updated.id}`,
          tag: `order-${updated.id}-${data.status}`,
        }).catch(() => {});
      } catch (e) { console.error("notifyUser import failed", e); }
    }

    return { ok: true };
  });
