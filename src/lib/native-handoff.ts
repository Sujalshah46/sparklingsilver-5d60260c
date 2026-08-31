/**
 * Native app <-> website OAuth handoff.
 *
 * The ONLY signal that a sign-in was started by the native app is an explicit
 * marker the app puts on the very first URL it opens in the Chrome Custom Tab /
 * ASWebAuthenticationSession. No User-Agent sniffing: a normal mobile browser
 * always finishes sign-in in place.
 */

export const APP_SESSION_PARAM = "app_session";
/** Legacy marker name kept so older app builds keep working. */
const LEGACY_PARAM = "ss_native";
const STORAGE_KEY = "ss_app_session";

const PARAMS = [APP_SESSION_PARAM, LEGACY_PARAM];

function readMarker(raw: string): boolean {
  try {
    const params = new URLSearchParams(raw.replace(/^[?#]/, ""));
    return PARAMS.some((p) => params.get(p) === "1");
  } catch {
    return false;
  }
}

/** True when this URL itself carries the app marker. */
export function urlHasAppSessionMarker(search: string, hash: string): boolean {
  return readMarker(search) || readMarker(hash);
}

/**
 * Persist the marker for the lifetime of this browser tab. Some providers /
 * brokers drop unrecognised query params along the redirect chain, so we latch
 * the flag the first time we ever see it inside the Custom Tab session.
 */
export function rememberAppSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

function hasStoredAppSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAppSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Should this OAuth callback be handed back to the native app?
 * Latches the marker when present so later hops in the same tab still qualify.
 */
export function shouldHandoffToApp(search: string, hash: string): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).ReactNativeWebView) return false; // already inside the app
  const direct = urlHasAppSessionMarker(search, hash);
  if (direct) rememberAppSession();
  const stored = hasStoredAppSession();
  if (direct || stored) {
    // Logging so the marker's survival across the full redirect chain is
    // observable in the Custom Tab's console / remote debugger.
    console.info("[oauth] app_session marker", { direct, stored, search, hash });
  }
  return direct || stored;
}

export function appCallbackUrl(search: string, hash: string): string {
  return `sparklingsilver://auth-callback${search}${hash}`;
}

/**
 * iOS Safari blocks programmatic `location.href = "customscheme://"` unless it
 * looks like a user gesture, so click a real anchor instead.
 */
export function openAppCallback(url: string) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.position = "fixed";
    a.style.opacity = "0";
    a.style.pointerEvents = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  } catch {
    window.location.href = url;
  }
}
