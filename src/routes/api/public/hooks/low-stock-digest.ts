import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/low-stock-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Light auth — anon key via apikey header (per scheduled-jobs pattern)
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: prods, error } = await sb.from("products")
          .select("name, sku, stock_quantity, low_stock_threshold");
        if (error) return new Response(error.message, { status: 500 });
        const low = (prods ?? [])
          .filter((p) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0))
          .map((p) => ({ name: p.name, sku: p.sku, qty: p.stock_quantity ?? 0, threshold: p.low_stock_threshold ?? 0 }))
          .sort((a, b) => a.qty - b.qty);

        if (low.length === 0) {
          return Response.json({ ok: true, sent: false, reason: "no low stock" });
        }

        const { sendAdminEmail, digestHtml } = await import("@/lib/admin-email.server");
        const r = await sendAdminEmail({
          subject: `Inventory digest — ${low.length} item${low.length === 1 ? "" : "s"} low`,
          html: digestHtml(low),
        });
        return Response.json({ ok: r.ok, count: low.length, skipped: r.skipped ?? false });
      },
    },
  },
});
