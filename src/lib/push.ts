// VAPID public key — safe to expose to the browser.
export const VAPID_PUBLIC_KEY =
  "BGgMqdj_AJAZLGRhr5qnfKGCB25B2rrAHfrALmXd1G7tAd4D9HM5uLFQOzjYNg_WQtotQWiiU4layc6IxSD4T1s";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  const reg =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.register("/sw.js"));

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

export function serializeSubscription(sub: PushSubscription) {
  const j = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: j.keys?.p256dh ?? "",
    auth: j.keys?.auth ?? "",
  };
}
