import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("user_id")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const adjustInput = z.object({
  product_id: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adjustInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: prod, error: pe } = await supabase.from("products")
      .select("stock_quantity").eq("id", data.product_id).maybeSingle();
    if (pe || !prod) throw new Error(pe?.message ?? "Product not found");
    const prev = prod.stock_quantity ?? 0;
    const next = Math.max(0, prev + data.delta);
    const { error: ue } = await supabase.from("products")
      .update({ stock_quantity: next }).eq("id", data.product_id);
    if (ue) throw new Error(ue.message);
    await supabase.from("stock_movements").insert({
      product_id: data.product_id,
      delta: next - prev,
      previous_qty: prev,
      new_qty: next,
      reason: data.reason ?? null,
      created_by: userId,
    });
    return { ok: true, stock_quantity: next };
  });

const setInput = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(0),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const setStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: prod, error: pe } = await supabase.from("products")
      .select("stock_quantity").eq("id", data.product_id).maybeSingle();
    if (pe || !prod) throw new Error(pe?.message ?? "Product not found");
    const prev = prod.stock_quantity ?? 0;
    const next = data.quantity;
    const { error: ue } = await supabase.from("products")
      .update({ stock_quantity: next }).eq("id", data.product_id);
    if (ue) throw new Error(ue.message);
    await supabase.from("stock_movements").insert({
      product_id: data.product_id,
      delta: next - prev,
      previous_qty: prev,
      new_qty: next,
      reason: data.reason ?? "Manual set",
      created_by: userId,
    });
    return { ok: true, stock_quantity: next };
  });

const thresholdInput = z.object({
  product_id: z.string().uuid(),
  low_stock_threshold: z.number().int().min(0).max(10000),
});

export const updateThreshold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => thresholdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("products")
      .update({ low_stock_threshold: data.low_stock_threshold })
      .eq("id", data.product_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
