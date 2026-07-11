import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/admin-bulk-link-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        if (secret !== process.env.CRON_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }
        const payload = (await request.json()) as {
          items: Array<{ sku: string; storage_path: string }>;
        };
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const results: Array<{
          sku: string;
          ok: boolean;
          error?: string;
          url?: string;
        }> = [];
        for (const item of payload.items) {
          const { data: signed, error: signErr } = await admin.storage
            .from("product-images")
            .createSignedUrl(item.storage_path, 60 * 60 * 24 * 365 * 30);
          if (signErr || !signed) {
            results.push({
              sku: item.sku,
              ok: false,
              error: signErr?.message ?? "sign failed",
            });
            continue;
          }
          const { error: updErr } = await admin
            .from("products")
            .update({
              image_url: signed.signedUrl,
              image_path: item.storage_path,
              has_image: true,
            })
            .eq("sku", item.sku);
          results.push({
            sku: item.sku,
            ok: !updErr,
            error: updErr?.message,
            url: signed.signedUrl,
          });
        }
        return new Response(JSON.stringify({ results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
