/**
 * Server-only push fan-out helper. Never import from a client module.
 * `*.server.ts` files are blocked from the client bundle by import protection.
 */
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@sparklingjewellers.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

type Payload = { title: string; body: string; url?: string; tag?: string };

async function sendToUserIds(userIds: string[], payload: Payload) {
  if (userIds.length === 0) return;
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs || subs.length === 0) return;

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
}

export async function notifyAdmins(payload: Payload) {
  try {
    configure();
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((r) => r.user_id);
    await sendToUserIds(adminIds, payload);
  } catch (err) {
    console.error("notifyAdmins failed", err);
  }
}

export async function notifyUser(userId: string, payload: Payload) {
  try {
    configure();
    await sendToUserIds([userId], payload);
  } catch (err) {
    console.error("notifyUser failed", err);
  }
}
