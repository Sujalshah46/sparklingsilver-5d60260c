import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subInput = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  user_agent: z.string().max(500).optional().nullable(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: data.endpoint,
          user_id: userId,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

/**
 * Internal helper — fan out a notification to every admin's push subscription.
 * Called from other server functions (e.g. placeOrder). Loads web-push and the
 * service-role client lazily so this module stays safe to import client-side.
 */
export async function notifyAdmins(payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((r) => r.user_id);
    if (adminIds.length === 0) return;
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", adminIds);
    if (!subs || subs.length === 0) return;

    const webpushMod = await import("web-push");
    const webpush = (webpushMod as unknown as { default?: typeof webpushMod }).default ?? webpushMod;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@sparklingjewellers.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } else {
            console.error("push send failed", err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("notifyAdmins failed", err);
  }
}
