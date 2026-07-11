import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  secret: z.string(),
  items: z.array(z.object({ sku: z.string(), storage_path: z.string() })),
});

export const bulkSignAndLinkProductImages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    if (data.secret !== process.env.CRON_SECRET) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ sku: string; ok: boolean; error?: string; url?: string }> = [];
    for (const item of data.items) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("product-images")
        .createSignedUrl(item.storage_path, 60 * 60 * 24 * 365 * 30);
      if (signErr || !signed) {
        results.push({ sku: item.sku, ok: false, error: signErr?.message ?? "sign failed" });
        continue;
      }
      const { error: updErr } = await supabaseAdmin
        .from("products")
        .update({ image_url: signed.signedUrl, image_path: item.storage_path, has_image: true })
        .eq("sku", item.sku);
      if (updErr) {
        results.push({ sku: item.sku, ok: false, error: updErr.message, url: signed.signedUrl });
        continue;
      }
      results.push({ sku: item.sku, ok: true, url: signed.signedUrl });
    }
    return { results };
  });
