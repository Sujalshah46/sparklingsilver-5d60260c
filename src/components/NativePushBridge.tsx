import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { saveExpoPushToken } from "@/lib/push.functions";

type NativeMessage =
  | { type: "ss-native-push-token"; token: string; platform?: string; deviceName?: string }
  | { type: "ss-native-navigate"; url: string };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __SS_NATIVE__?: { platform?: string; version?: string; pushToken?: string; deviceName?: string };
  }
}

/** Accounts exempt from screenshot / screen-recording protection. */
const CAPTURE_EXEMPT_EMAILS = ["appstore.review@sparklingsilver.in"];

function postCapturePolicy(allow: boolean) {
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "ss-web-capture-policy", allow }),
  );
}

/** Tells the native wrapper whether capture protection should be relaxed. */
async function syncCapturePolicy() {
  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email?.toLowerCase() ?? null;
    postCapturePolicy(!!email && CAPTURE_EXEMPT_EMAILS.includes(email));
  } catch {
    postCapturePolicy(false);
  }
}

/**
 * Bridges the native iOS/Android wrapper to the web app.
 * The wrapper registers for real APNs/FCM notifications through Expo and hands
 * the device token over here, so we can store it against the signed-in user.
 * Also handles notification taps (native asks us to route to a deep link).
 */
export function NativePushBridge() {
  const router = useRouter();
  const saveToken = useServerFn(saveExpoPushToken);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let disposed = false;

    const register = async (token: string, platform?: string, deviceName?: string) => {
      if (disposed || !token) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return; // retried after sign-in below
        await saveToken({
          data: {
            token,
            platform: platform ?? null,
            device_name: deviceName ?? null,
          },
        });
      } catch (err) {
        console.error("native push token registration failed", err);
      }
    };

    const handle = (raw: unknown) => {
      let msg: NativeMessage | null = null;
      try {
        msg = typeof raw === "string" ? (JSON.parse(raw) as NativeMessage) : null;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "ss-native-push-token") {
        window.__SS_NATIVE__ = {
          ...(window.__SS_NATIVE__ ?? {}),
          platform: msg.platform,
          pushToken: msg.token,
          deviceName: msg.deviceName,
        };
        void register(msg.token, msg.platform, msg.deviceName);
      } else if (msg.type === "ss-native-navigate" && msg.url) {
        try {
          const target = new URL(msg.url, window.location.origin);
          if (target.origin === window.location.origin) {
            void router.navigate({ href: target.pathname + target.search + target.hash });
          }
        } catch {
          /* ignore malformed deep link */
        }
      }
    };

    const onMessage = (e: MessageEvent) => handle(e.data);
    window.addEventListener("message", onMessage);
    // React Native Android delivers postMessage on document, not window.
    document.addEventListener("message", onMessage as unknown as EventListener);

    // Token may have been injected before this component mounted.
    const injected = window.__SS_NATIVE__;
    if (injected?.pushToken) {
      void register(injected.pushToken, injected.platform, injected.deviceName);
    }

    // Re-register once the user signs in (token arrives before auth on cold start).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void syncCapturePolicy();
      }

      // Post the Supabase session back to the native React Native shell
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: "ss-session",
          session: session
            ? {
                access_token: session.access_token,
                user: {
                  id: session.user?.id,
                  email: session.user?.email,
                },
              }
            : null,
        })
      );

      if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED") return;
      const t = window.__SS_NATIVE__?.pushToken;
      if (t) void register(t, window.__SS_NATIVE__?.platform, window.__SS_NATIVE__?.deviceName);
    });

    // Tell the wrapper the web layer is ready to receive the token.
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ss-web-ready" }));
    void syncCapturePolicy();

    return () => {
      disposed = true;
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage as unknown as EventListener);
      sub.subscription.unsubscribe();
    };
  }, [router, saveToken]);

  return null;
}
