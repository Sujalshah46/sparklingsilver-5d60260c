import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// ---------- Lookup by barcode ----------
const lookupSchema = z.object({ barcode: z.string().trim().min(1).max(128) });

// Printed tag pattern: e.g. AR(CH)-196, AS(NK)-1002
const LABEL_RE = /^[A-Z]{1,4}\([A-Z]{1,4}\)-\d+$/i;

export const lookupByBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const raw = data.barcode.trim();
    const isLabel = LABEL_RE.test(raw);
    const cols = "id, name, sku, barcode, label_code, gross_weight, price, image_url, stock_quantity, low_stock_threshold, updated_at, description, category_id, subcategory_id, categories:categories!category_id(name), subcategories:subcategories!subcategory_id(name)";
    const { data: product, error } = await supabase
      .from("products")
      .select(cols)
      .or(isLabel ? `label_code.eq.${raw},barcode.eq.${raw}` : `barcode.eq.${raw},label_code.eq.${raw},sku.eq.${raw}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { found: !!product, product, parsedLabel: isLabel ? raw : null };
  });


// ---------- Adjust stock via scan (writes action_type) ----------
const adjustSchema = z.object({
  product_id: z.string().uuid(),
  delta: z.number().int(),
  action_type: z.enum(["increment", "decrement"]),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const scanAdjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adjustSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: prod, error: pe } = await supabase.from("products")
      .select("stock_quantity, name, sku, low_stock_threshold").eq("id", data.product_id).maybeSingle();
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
      reason: data.reason ?? `Scan ${data.action_type}`,
      action_type: data.action_type,
      created_by: userId,
    });
    return { ok: true, previous: prev, next };
  });

// ---------- Quick create from barcode ----------
const createSchema = z.object({
  barcode: z.string().trim().min(1).max(128),
  label_code: z.string().trim().max(64).optional().nullable(),
  gross_weight: z.number().nonnegative().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(64),
  price: z.number().nonnegative(),
  stock_quantity: z.number().int().min(0).default(0),
  description: z.string().trim().max(4000).optional().nullable(),
  image_url: z.string().trim().min(1).default("/placeholder.svg"),
  category_id: z.string().uuid().optional().nullable(),
});


function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `p-${Date.now()}`;
}

export const scanCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    // Ensure barcode not already used
    const { data: existing } = await supabase.from("products").select("id").eq("barcode", data.barcode).maybeSingle();
    if (existing) throw new Error("Barcode already exists");

    let slug = slugify(data.name);
    // Ensure slug uniqueness
    const { data: slugHit } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (slugHit) slug = `${slug}-${Date.now().toString(36)}`;

    const { data: row, error } = await supabase.from("products").insert({
      barcode: data.barcode,
      label_code: data.label_code ?? null,
      name: data.name,
      sku: data.sku,
      slug,
      price: data.price,
      stock_quantity: data.stock_quantity,
      description: data.description ?? null,
      image_url: data.image_url,
      category_id: data.category_id ?? null,
      metal: "silver",
      purity: "925",
      gross_weight: data.gross_weight ?? 0,
      net_weight: 0,
    }).select("id, name, sku, barcode, label_code, gross_weight, price, image_url, stock_quantity, low_stock_threshold, updated_at").single();
    if (error) throw new Error(error.message);


    await supabase.from("stock_movements").insert({
      product_id: row.id,
      delta: data.stock_quantity,
      previous_qty: 0,
      new_qty: data.stock_quantity,
      reason: "Created via scan",
      action_type: "created",
      created_by: userId,
    });

    return { product: row };
  });

// ---------- Inline edit ----------
const editSchema = z.object({
  product_id: z.string().uuid(),
  patch: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    price: z.number().nonnegative().optional(),
    description: z.string().trim().max(4000).optional().nullable(),
    image_url: z.string().trim().min(1).optional(),
    category_id: z.string().uuid().optional().nullable(),
    label_code: z.string().trim().max(64).optional().nullable(),
    gross_weight: z.number().nonnegative().optional(),
  }),
});

export const scanEditProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("products").update(data.patch).eq("id", data.product_id);
    if (error) throw new Error(error.message);
    const { data: cur } = await supabase.from("products").select("stock_quantity").eq("id", data.product_id).maybeSingle();
    const q = cur?.stock_quantity ?? 0;
    await supabase.from("stock_movements").insert({
      product_id: data.product_id,
      delta: 0,
      previous_qty: q,
      new_qty: q,
      reason: `Edited: ${Object.keys(data.patch).join(", ")}`,
      action_type: "edit",
      created_by: userId,
    });
    return { ok: true };
  });
