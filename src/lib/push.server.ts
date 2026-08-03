/**
 * Server-only push fan-out helper. Never import from a client module.
 * `*.server.ts` files are blocked from the client bundle by import protection.
 */
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
let webPushReady = false;
/**
 * Configures web-push. Never throws: missing VAPID keys must not stop native
 * (Expo) notifications from going out.
 */
function configure() {
  if (configured) return;
  configured = true;
  try {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@sparklingjewellers.com",
      pub,
      priv,
    );
    webPushReady = true;
  } catch (err) {
    console.error("web-push configure failed", err);
  }
}


type Payload = { title: string; body: string; url?: string; tag?: string };

/** Native push via Expo's push service (works inside the iOS/Android wrapper). */
async function sendExpoPush(userIds: string[], payload: Payload) {
  const { data: rows } = await supabaseAdmin
    .from("expo_push_tokens")
    .select("token")
    .in("user_id", userIds);
  const tokens = (rows ?? []).map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return;

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: "default",
      priority: "high",
      channelId: "orders",
      data: { url: payload.url ?? "/", tag: payload.tag },
    }));
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as {
        data?: Array<{ status: string; details?: { error?: string } }>;
      };
      // Drop tokens Expo reports as unregistered so the table stays clean.
      const dead = (json.data ?? [])
        .map((r, idx) =>
          r?.status === "error" && r.details?.error === "DeviceNotRegistered" ? chunk[idx] : null,
        )
        .filter((t): t is string => Boolean(t));
      if (dead.length > 0) {
        await supabaseAdmin.from("expo_push_tokens").delete().in("token", dead);
      }
    } catch (err) {
      console.error("expo push send failed", err);
    }
  }
}

async function sendToUserIds(userIds: string[], payload: Payload) {
  if (userIds.length === 0) return;
  await sendExpoPush(userIds, payload);

  if (!webPushReady) return;
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
