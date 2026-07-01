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

const baseFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes"),
  sku: z.string().trim().min(1).max(64),
  description: z.string().trim().max(4000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  subcategory_id: z.string().uuid().optional().nullable(),
  collection_id: z.string().uuid().optional().nullable(),
  metal: z.enum(["gold", "silver", "platinum", "diamond"]),
  purity: z.string().trim().min(1).max(32),
  gross_weight: z.number().nonnegative(),
  net_weight: z.number().nonnegative(),
  stone_weight: z.number().nonnegative().optional().nullable(),
  stone_type: z.string().trim().max(120).optional().nullable(),
  price: z.number().nonnegative(),
  making_charge_pct: z.number().min(0).max(100).optional().nullable(),
  moq: z.number().int().min(1).optional().nullable(),
  image_url: z.string().trim().min(1),
  images: z.array(z.string()).optional().nullable(),
  sizes: z.array(z.string()).optional().nullable(),
  occasion: z.string().trim().max(120).optional().nullable(),
  is_new: z.boolean().optional(),
  is_bestseller: z.boolean().optional(),
  is_trending: z.boolean().optional(),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(5),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object({ id: z.string().uuid(), patch: z.object(baseFields).partial() });
const deleteSchema = z.object({ id: z.string().uuid() });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: row, error } = await supabase.from("products").insert(data).select("id, slug").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("products").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
