import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "product-images";
const SIZES = ["thumb", "card", "detail"] as const;
// 10 years in seconds — matches original image sign expiry.
const EXPIRES_IN = 60 * 60 * 24 * 365 * 10;

function basenameFromImageUrl(imageUrl: string): string {
  // Strip query string (Supabase Storage does the same on upload keys), then
  // grab the last path segment. Decode %28 / %29 etc. to match the actual
  // filenames written to storage by the backfill.
  const beforeQuery = imageUrl.split(/[?#]/)[0] ?? imageUrl;
  const seg = beforeQuery.split("/").pop() ?? beforeQuery;
  try { return decodeURIComponent(seg); } catch { return seg; }
}

async function ensureAdmin(supabase: unknown, userId: string) {
  const s = supabase as { from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } };
  const { data } = await s.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/**
 * Repair image_variants URLs on every product. The initial backfill uploaded
 * variant files correctly to `variants/{size}/{basename}` but stored broken
 * public URLs (bucket is private + basename included the signed-URL query
 * string). This regenerates long-lived signed URLs for the existing files
 * and rewrites image_variants — no re-encoding.
 */
export const repairImageVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let updated = 0;
    let skipped = 0;
    const failures: Array<{ sku: string; err: string }> = [];

    const PAGE = 500;
    let from = 0;
    for (;;) {
      const { data: rows, error } = await supabaseAdmin
        .from("products")
        .select("id, sku, image_url")
        .not("image_url", "is", null)
        .order("sku", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        const imageUrl = (row as { image_url: string | null }).image_url;
        const sku = (row as { sku: string }).sku;
        if (!imageUrl) { skipped++; continue; }
        const basename = basenameFromImageUrl(imageUrl);
        const variants: Record<string, string> = {};
        let anyMissing = false;
        for (const size of SIZES) {
          const path = `variants/${size}/${basename}`;
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(path, EXPIRES_IN);
          if (signErr || !signed?.signedUrl) {
            anyMissing = true;
            failures.push({ sku, err: `${size}: ${signErr?.message ?? "no url"}` });
            break;
          }
          variants[size] = signed.signedUrl;
        }
        if (anyMissing) continue;
        const { error: updErr } = await supabaseAdmin
          .from("products")
          .update({ image_variants: variants })
          .eq("id", (row as { id: string }).id);
        if (updErr) {
          failures.push({ sku, err: `update: ${updErr.message}` });
          continue;
        }
        updated++;
      }

      if (rows.length < PAGE) break;
      from += PAGE;
    }

    return { updated, skipped, failed: failures.length, failures: failures.slice(0, 50) };
  });
