// Central site config — single source of truth for URLs and contact handles.
// VITE_SITE_URL can override at build time; default is the production Lovable URL.
export const SITE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://sparkling-jewellers-llp.lovable.app";

// WhatsApp number in E.164 without "+" (WhatsApp deep-link format).
// Official Sparkling Silver LLP number. Used by WhatsAppFab and Contact page.
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
  "Hello Sparkling Silver LLP, I am interested in your jewellery products. Please assist me.";

export const WHATSAPP_LINK_TARGET = "_blank";

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
