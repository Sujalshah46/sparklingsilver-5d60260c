import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusInput = z.object({
  order_id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "rejected", "processing", "ready", "dispatched", "delivered", "cancelled"]),
  admin_notes: z.string().trim().max(2000).optional().nullable(),
});

async function ensureAdmin(supabase: { rpc?: unknown }, userId: string) {
  const s = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } };
  const { data } = await s.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase
      .from("orders")
      .update({
        status: data.status,
        admin_notes: data.admin_notes ?? null,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
