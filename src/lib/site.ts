// Central site config — single source of truth for URLs and contact handles.
// VITE_SITE_URL can override at build time; default is the production Lovable URL.
export const SITE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://sparkling-jewellers-llp.lovable.app";

// WhatsApp number in E.164 without "+" (wa.me format). TODO: replace with the
// official Sparkling Jewellery LLP number. Used by WhatsAppFab and Contact page.
export const WHATSAPP_NUMBER = "919999999999";

export const WHATSAPP_DEFAULT_MESSAGE =
  "Hello Sparkling Jewellery LLP, I am interested in your jewellery products. Please assist me.";

export function whatsappUrl(message: string = WHATSAPP_DEFAULT_MESSAGE) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
