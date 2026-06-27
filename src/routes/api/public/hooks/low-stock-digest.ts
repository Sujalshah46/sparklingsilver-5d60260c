import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/low-stock-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Light auth — anon key via apikey header (per scheduled-jobs pattern)
          const apikey = request.headers.get("apikey");
          if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
            return new Response("Unauthorized", { status: 401 });
          }
          const url = process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!url || !serviceKey) {
            console.error("[low-stock-digest] missing Supabase env");
            return new Response("Server misconfigured", { status: 500 });
          }
          const sb = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: prods, error } = await sb.from("products")
            .select("name, sku, stock_quantity, low_stock_threshold");
          if (error) {
            console.error("[low-stock-digest] products query failed", error);
            return new Response("Query failed", { status: 500 });
          }
          const low = (prods ?? [])
            .filter((p) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0))
            .map((p) => ({ name: p.name, sku: p.sku, qty: p.stock_quantity ?? 0, threshold: p.low_stock_threshold ?? 0 }))
            .sort((a, b) => a.qty - b.qty);

          if (low.length === 0) {
            return Response.json({ ok: true, sent: false, reason: "no low stock" });
          }

          try {
            const { sendAdminEmail, digestHtml } = await import("@/lib/admin-email.server");
            const r = await sendAdminEmail({
              subject: `Inventory digest — ${low.length} item${low.length === 1 ? "" : "s"} low`,
              html: digestHtml(low),
            });
            return Response.json({ ok: r.ok, count: low.length, skipped: r.skipped ?? false });
          } catch (e) {
            console.error("[low-stock-digest] email send failed", e);
            return Response.json({ ok: false, count: low.length, error: "email_failed" }, { status: 502 });
          }
        } catch (e) {
          console.error("[low-stock-digest] unhandled", e);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
