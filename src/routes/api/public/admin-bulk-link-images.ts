import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({
  items: z
    .array(z.object({ sku: z.string().trim().min(1).max(120), storage_path: z.string().trim().min(1).max(500) }))
    .min(1)
    .max(200),
});

export const Route = createFileRoute("/api/public/admin-bulk-link-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          console.error("[admin-bulk-link-images] CRON_SECRET not configured");
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-cron-secret") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length) {
          return new Response("Forbidden", { status: 403 });
        }
        const { timingSafeEqual } = await import("node:crypto");
        if (!timingSafeEqual(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("Invalid request body", { status: 400 });
        }
        const payload = parsed.data;
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
