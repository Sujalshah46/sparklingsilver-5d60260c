/**
 * Native (in-app) sign-in bridge helpers.
 *
 * Inside the iOS/Android wrapper, Google and Apple sign-in run natively; the
 * app hands the resulting session to the web layer via postMessage. In a normal
 * browser none of this applies and the existing web OAuth flow runs unchanged.
 */

export const NATIVE_AUTH_ERROR_EVENT = "ss-native-auth-error";

/** True only inside the native WebView wrapper. */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

/** Ask the native app to run its own Google/Apple sign-in. */
export function requestNativeLogin(provider: "google" | "apple"): boolean {
  if (!isNativeApp()) return false;
  window.ReactNativeWebView!.postMessage(
    JSON.stringify({ type: "ss-request-native-login", provider }),
  );
  return true;
}
