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

    const results: Array<{ sku: string; status: "updated" | "not_found" | "failed"; previous?: number; next?: number; error?: string }> = [];
    const reason = data.reason || "CSV bulk import";

    for (const row of data.rows) {
      const p = bySku.get(row.sku);
      if (!p) { results.push({ sku: row.sku, status: "not_found" }); continue; }
      const prev = p.stock_quantity ?? 0;
      const next = row.quantity;
      if (prev === next) { results.push({ sku: row.sku, status: "updated", previous: prev, next }); continue; }
      try {
        const { error: upErr } = await supabase.from("products").update({ stock_quantity: next }).eq("id", p.id);
        if (upErr) throw new Error(upErr.message);
        const { error: mvErr } = await supabase.from("stock_movements").insert({
          product_id: p.id,
          delta: next - prev,
          previous_qty: prev,
          new_qty: next,
          reason,
          created_by: userId,
        });
        if (mvErr) console.error("[bulkUpdateStock] movement insert failed", mvErr);
        await maybeAlert(supabase, p.id, prev, next);
        results.push({ sku: row.sku, status: "updated", previous: prev, next });
      } catch (e) {
        console.error("[bulkUpdateStock] row failed", row.sku, e);
        results.push({ sku: row.sku, status: "failed", error: e instanceof Error ? e.message : "Update failed" });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const notFound = results.filter((r) => r.status === "not_found").length;
    const failed = results.filter((r) => r.status === "failed").length;
    return { ok: true, updated, notFound, failed, results };
  });

const bulkApplyInput = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(200),
  quantity: z.number().int().min(0).max(1000000).optional().nullable(),
  low_stock_threshold: z.number().int().min(0).max(10000).optional().nullable(),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const bulkApplyInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkApplyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const hasQty = data.quantity !== null && data.quantity !== undefined;
    const hasThr = data.low_stock_threshold !== null && data.low_stock_threshold !== undefined;
    if (!hasQty && !hasThr) throw new Error("Provide quantity and/or threshold");

    const { data: prods, error: fe } = await supabase.from("products")
      .select("id, stock_quantity").in("id", data.product_ids);
    if (fe) throw new Error(fe.message);

    const rows = prods ?? [];
    if (rows.length === 0) return { ok: true, updated: 0, failed: 0 };

    const patch: { stock_quantity?: number; low_stock_threshold?: number } = {};
    if (hasQty) patch.stock_quantity = data.quantity as number;
    if (hasThr) patch.low_stock_threshold = data.low_stock_threshold as number;

    const ids = rows.map((p: { id: string }) => p.id);
    const { error: ue } = await supabase.from("products").update(patch).in("id", ids);
    if (ue) throw new Error(ue.message);

    if (hasQty) {
      const reason = data.reason || "Bulk update";
      const next = data.quantity as number;
      const movements = rows
        .map((p: { id: string; stock_quantity: number | null }) => ({ id: p.id, prev: p.stock_quantity ?? 0 }))
        .filter((p) => p.prev !== next)
        .map((p) => ({
          product_id: p.id,
          delta: next - p.prev,
          previous_qty: p.prev,
          new_qty: next,
          reason,
          created_by: userId,
        }));
      if (movements.length) {
        const { error: me } = await supabase.from("stock_movements").insert(movements);
        if (me) console.error("[bulkApplyInventory] movement insert failed", me);
      }
    }

    return { ok: true, updated: rows.length, failed: 0 };
  });

const inventoryListInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  filter: z.enum(["all", "low", "out"]).default("all"),
});

export const getAdminInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inventoryListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { getPaginationRange } = await import("./pagination");
    const { from, to, limit } = getPaginationRange(data.page, data.limit);

    let query = supabase
      .from("products_inventory_view")
      .select("id, name, sku, image_url, stock_quantity, low_stock_threshold, in_stock, category_id", { count: "exact" });

    if (data.search) {
      const safeSearch = data.search.trim().replace(/[\\%_,()*"']/g, (c) => `\\${c}`);
      const pattern = `%${safeSearch}%`;
      query = query.or(`name.ilike.${pattern},sku.ilike.${pattern}`);
    }

    if (data.filter === "out") {
      query = query.eq("is_out_of_stock", true);
    } else if (data.filter === "low") {
      query = query.eq("is_low_stock", true);
    }

    const { data: rows, count, error } = await query
      .order("name", { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);

    const total = count ?? 0;

    const [allCountRes, lowCountRes, outCountRes] = await Promise.all([
      supabase.from("products_inventory_view").select("id", { count: "exact", head: true }),
      supabase.from("products_inventory_view").select("id", { count: "exact", head: true }).eq("is_low_stock", true),
      supabase.from("products_inventory_view").select("id", { count: "exact", head: true }).eq("is_out_of_stock", true),
    ]);

    return {
      products: rows ?? [],
      total,
      pages: Math.ceil(total / limit),
      page: data.page,
      limit,
      counts: {
        all: allCountRes.count ?? 0,
        low: lowCountRes.count ?? 0,
        out: outCountRes.count ?? 0,
      },
    };
  });


