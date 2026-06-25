import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("user_id")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function maybeAlert(supabase: any, productId: string, prev: number, next: number) {
  const { data: p } = await supabase.from("products")
    .select("name, sku, low_stock_threshold").eq("id", productId).maybeSingle();
  if (!p) return;
  const thr = p.low_stock_threshold ?? 0;
  const wasOk = prev > thr;
  const nowLow = next <= thr;
  if (wasOk && nowLow) {
    try {
      const { sendAdminEmail, lowStockAlertHtml } = await import("./admin-email.server");
      const subject = next === 0
        ? `OUT OF STOCK: ${p.name}`
        : `Low stock: ${p.name} (${next} left)`;
      await sendAdminEmail({ subject, html: lowStockAlertHtml({ name: p.name, sku: p.sku, qty: next, threshold: thr }) });
    } catch (e) {
      console.error("[maybeAlert] failed", e);
    }
  }
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
    await maybeAlert(supabase, data.product_id, prev, next);
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
    await maybeAlert(supabase, data.product_id, prev, next);
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

const bulkInput = z.object({
  rows: z.array(z.object({
    sku: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(0).max(1000000),
  })).min(1).max(1000),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const bulkUpdateStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const skus = data.rows.map((r) => r.sku);
    const { data: prods, error: fe } = await supabase.from("products")
      .select("id, sku, stock_quantity").in("sku", skus);
    if (fe) throw new Error(fe.message);
    const bySku = new Map((prods ?? []).map((p: any) => [p.sku, p]));

    const results: Array<{ sku: string; status: "updated" | "not_found"; previous?: number; next?: number }> = [];
    const reason = data.reason || "CSV bulk import";

    for (const row of data.rows) {
      const p = bySku.get(row.sku);
      if (!p) { results.push({ sku: row.sku, status: "not_found" }); continue; }
      const prev = p.stock_quantity ?? 0;
      const next = row.quantity;
      if (prev === next) { results.push({ sku: row.sku, status: "updated", previous: prev, next }); continue; }
      await supabase.from("products").update({ stock_quantity: next }).eq("id", p.id);
      await supabase.from("stock_movements").insert({
        product_id: p.id,
        delta: next - prev,
        previous_qty: prev,
        new_qty: next,
        reason,
        created_by: userId,
      });
      await maybeAlert(supabase, p.id, prev, next);
      results.push({ sku: row.sku, status: "updated", previous: prev, next });
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const notFound = results.filter((r) => r.status === "not_found").length;
    return { ok: true, updated, notFound, results };
  });
