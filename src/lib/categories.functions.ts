import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(
  supabase: { from: (t: string) => any },
  userId: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const setInput = z.object({
  category_id: z.string().uuid(),
  storage_path: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[A-Za-z0-9._\-/]+$/, "Invalid storage path"),
});

export const setCategoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    // Verify object exists in the category-images bucket before linking it.
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const lastSlash = data.storage_path.lastIndexOf("/");
    const folder = lastSlash >= 0 ? data.storage_path.slice(0, lastSlash) : "";
    const name = lastSlash >= 0 ? data.storage_path.slice(lastSlash + 1) : data.storage_path;
    const { data: listed, error: listErr } = await supabaseAdmin.storage
      .from("category-images")
      .list(folder, { search: name, limit: 1 });
    if (listErr) throw new Error(listErr.message);
    if (!listed?.some((o) => o.name === name)) {
      throw new Error("Uploaded image not found in category-images bucket");
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("category-images")
      .createSignedUrl(data.storage_path, 60 * 60 * 24 * 365);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Sign failed");

    const { error: updErr } = await supabase
      .from("categories")
      .update({ image_url: signed.signedUrl })
      .eq("id", data.category_id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, image_url: signed.signedUrl };
  });

const clearInput = z.object({ category_id: z.string().uuid() });

export const clearCategoryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clearInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase
      .from("categories")
      .update({ image_url: null })
      .eq("id", data.category_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
