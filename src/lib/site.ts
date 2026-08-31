// Central site config — single source of truth for URLs and contact handles.
// VITE_SITE_URL can override at build time; default is the production Lovable URL.
export const SITE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://sparklingsilver.in";

// WhatsApp number in E.164 without "+" (WhatsApp deep-link format).
// Official Sparkling Silver number. Used by WhatsAppFab and Contact page.
const RAW_WHATSAPP_NUMBER = "919330615237";

/**
 * Validates an E.164-style WhatsApp number (digits only, no "+"):
 * - 8 to 15 digits (ITU-T E.164 max is 15)
 * - Must start with a non-zero country code digit
 * Throws at module load if the configured number is invalid.
 */
export function validateWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/[\s\-()+]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new Error(
      `Invalid WhatsApp number "${raw}": must be 8-15 digits in E.164 format without leading zero.`,
    );
  }
  return digits;
}

export const WHATSAPP_NUMBER = validateWhatsAppNumber(RAW_WHATSAPP_NUMBER);

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hello Sparkling Silver, I am interested in your jewellery products. Please assist me.";

export const WHATSAPP_LINK_TARGET = "_blank";

// Official Sparkling Silver Instagram profile.
export const INSTAGRAM_URL =
  "https://www.instagram.com/_sparklingsilver_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";

// Categories that exist in the database but are hidden from the public web app.
// Products in these categories won't be reachable via category pages, product pages, or search.
export const HIDDEN_CATEGORY_SLUGS: readonly string[] = ["open-close", "victoria"];
export const HIDDEN_CATEGORY_NAMES_LC: readonly string[] = ["open close", "victoria"];

export function whatsappUrl(message: string = WHATSAPP_DEFAULT_MESSAGE) {
  // Use the official WhatsApp short link. A click handler opens it externally
  // so the Lovable preview iframe does not try to embed WhatsApp.
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppUrl(url: string) {
  if (typeof window === "undefined") return;

  const popup = window.open(url, WHATSAPP_LINK_TARGET);
  if (popup) {
    popup.opener = null;
    return;
  }

  window.location.assign(url);
}

export function openInstagramUrl(url: string = INSTAGRAM_URL) {
  if (typeof window === "undefined") return;

  const popup = window.open(url, "_blank");
  if (popup) {
    popup.opener = null;
    return;
  }

  window.location.assign(url);
}

export function absoluteUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE_URL}${path}`;
}

/**
 * Only allow same-origin path-only redirects.
 * Rejects absolute URLs, protocol-relative `//evil.com`, and non-paths.
 */
export function sanitizeRedirect(raw: string | undefined | null, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}

// ---------------------------------------------------------------------------
// Canonical origin for OAuth
// ---------------------------------------------------------------------------
// Every OAuth round-trip (Google via the Lovable broker, Apple Services ID)
// must start and finish on ONE origin. The broker binds the `state` value to
// the initiating origin's storage, so a flow started on the apex host
// (sparklingsilver.in) and returned to www — or vice versa — fails with
// "State verification failed" / invalid_request. Mobile browsers hit this more
// often because they do a full-page round-trip and partition storage harder.
export const CANONICAL_ORIGIN = "https://www.sparklingsilver.in";
export const CANONICAL_OAUTH_CALLBACK = `${CANONICAL_ORIGIN}/auth-callback`;

/**
 * Hosts where we must NOT rewrite the origin: the Lovable editor preview and
 * local dev. Pinning those to the live domain would send a developer's
 * sign-in to production instead of back to the preview they started in.
 */
function isPreviewOrDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host.includes("id-preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev")
  );
}

/**
 * The redirect_uri handed to every OAuth provider. Hardcoded to the canonical
 * production origin so it can never vary by which host the visitor typed.
 * Preview/dev keeps its own origin so sign-in still works while building.
 */
export function oauthRedirectUri(): string {
  if (typeof window === "undefined") return CANONICAL_OAUTH_CALLBACK;
  if (isPreviewOrDevHost(window.location.host)) {
    return `${window.location.origin}/auth-callback`;
  }
  return CANONICAL_OAUTH_CALLBACK;
}

/**
 * Marker the native wrapper appends to the OAuth callback URL when it launches
 * the flow in a Chrome Custom Tab / ASWebAuthenticationSession. Only then may
 * the web app bounce to the `sparklingsilver://` scheme — a normal mobile
 * browser must complete sign-in in place.
 */
export const NATIVE_OAUTH_MARKER = "ss_native";

export function isNativeOAuthHandoff(search: string, hash: string): boolean {
  const check = (raw: string) => {
    try {
      return new URLSearchParams(raw.replace(/^[?#]/, "")).get(NATIVE_OAUTH_MARKER) === "1";
    } catch {
      return false;
    }
  };
  return check(search) || check(hash);
}

/**
 * If the visitor landed on a non-canonical production host (apex, or the
 * *.lovable.app published host), return the same path on the canonical host so
 * they are moved BEFORE they ever click sign-in. Returns null when already
 * canonical, or on preview/dev hosts.
 */
export function canonicalHostRedirectUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (isPreviewOrDevHost(url.host)) return null;
  const canonicalHost = new URL(CANONICAL_ORIGIN).host;
  if (url.host === canonicalHost) return null;
  const isOurs =
    url.host === "sparklingsilver.in" || url.host.endsWith(".lovable.app");
  if (!isOurs) return null;
  return `${CANONICAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
}
