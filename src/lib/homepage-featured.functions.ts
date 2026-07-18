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

export const setProductFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      field: z.enum(["is_new", "is_bestseller"]),
      value: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const patch: Record<string, boolean> = {};
    patch[data.field] = data.value;
    const { error } = await supabase.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setHomepageFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), featured: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.featured) {
      // find current max order
      const { data: rows } = await supabase
        .from("products")
        .select("homepage_featured_order")
        .eq("homepage_featured", true)
        .order("homepage_featured_order", { ascending: false })
        .limit(1);
      const nextOrder =
        rows && rows.length > 0 && rows[0].homepage_featured_order
          ? Number(rows[0].homepage_featured_order) + 1
          : 1;
      const { error } = await supabase
        .from("products")
        .update({ homepage_featured: true, homepage_featured_order: nextOrder })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("products")
        .update({ homepage_featured: false, homepage_featured_order: null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const reorderHomepageFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderedIds: z.array(z.string().uuid()).max(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    // Two-pass to avoid the partial unique index colliding during renumbering.
    // Pass 1: move all to negative offsets.
    for (let i = 0; i < data.orderedIds.length; i++) {
      const id = data.orderedIds[i];
      const { error } = await supabase
        .from("products")
        .update({ homepage_featured_order: -(i + 1) })
        .eq("id", id)
        .eq("homepage_featured", true);
      if (error) throw new Error(error.message);
    }
    // Pass 2: assign final 1..N
    for (let i = 0; i < data.orderedIds.length; i++) {
      const id = data.orderedIds[i];
      const { error } = await supabase
        .from("products")
        .update({ homepage_featured_order: i + 1 })
        .eq("id", id)
        .eq("homepage_featured", true);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const clearHomepageFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase
      .from("products")
      .update({ homepage_featured: false, homepage_featured_order: null })
      .eq("homepage_featured", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
