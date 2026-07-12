import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { items } = await req.json() as { items: Array<{ sku: string; storage_path: string }> };
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const results: any[] = [];
    for (const item of items) {
      const { data: signed, error: signErr } = await admin.storage
        .from("product-images")
        .createSignedUrl(item.storage_path, 60 * 60 * 24 * 365 * 30);
      if (signErr || !signed) {
        results.push({ sku: item.sku, ok: false, error: signErr?.message });
        continue;
      }
      const { error: updErr } = await admin
        .from("products")
        .update({ image_url: signed.signedUrl, image_path: item.storage_path, has_image: true })
        .eq("sku", item.sku);
      results.push({ sku: item.sku, ok: !updErr, error: updErr?.message });
    }
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
