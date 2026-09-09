/**
 * Native (in-app) sign-in bridge helpers.
 *
 * Inside the iOS/Android wrapper, Google and Apple sign-in run natively; the
 * app hands the resulting session to the web layer via postMessage. In a normal
 * browser none of this applies and the existing web OAuth flow runs unchanged.
 */

import { useEffect, useState } from "react";

export const NATIVE_AUTH_ERROR_EVENT = "ss-native-auth-error";

/** True only inside the native WebView wrapper. */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

/** "ios" | "android" inside the wrapper, otherwise null (plain browser). */
export function nativePlatform(): "ios" | "android" | null {
  if (!isNativeApp()) return null;
  const injected = window.__SS_NATIVE__?.platform?.toLowerCase();
  if (injected === "ios" || injected === "android") return injected;
  // The injected object can arrive a tick late; fall back to the user agent.
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return null;
}

/**
 * Which social sign-in buttons may be shown on the current platform.
 * Web: both. Android app: Google only. iOS app: none (email/password only).
 */
export function useSocialAuthAvailability(): { apple: boolean; google: boolean } {
  const [state, setState] = useState({ apple: false, google: false });

  useEffect(() => {
    let tries = 0;
    const evaluate = () => {
      const platform = nativePlatform();
      if (platform === "ios") setState({ apple: false, google: false });
      else if (platform === "android") setState({ apple: false, google: true });
      else setState({ apple: true, google: true });
      // Keep re-checking briefly in case the native bridge injects late.
      if (isNativeApp() && !window.__SS_NATIVE__?.platform && tries++ < 10) {
        setTimeout(evaluate, 150);
      }
    };
    evaluate();
  }, []);

  return state;
}

/** Ask the native app to run its own Google/Apple sign-in. */
export function requestNativeLogin(provider: "google" | "apple"): boolean {
  if (!isNativeApp()) return false;
  window.ReactNativeWebView!.postMessage(
    JSON.stringify({ type: "ss-request-native-login", provider }),
  );
  return true;
}
