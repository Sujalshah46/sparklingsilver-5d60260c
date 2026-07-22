/**
 * SEO title templates — single source of truth for the site's brand name.
 *
 * All route `head()` titles MUST go through `pageTitle()` (or `BRAND`) so the
 * brand string is defined in exactly one place. Never hardcode the brand
 * name inline in a route file — that's how "LLP" crept back in previously.
 */

export const BRAND = "Sparkling Silver" as const;
export const SITE_ORIGIN = "https://sparklingsilver.in" as const;

const SEPARATOR = " — ";

/**
 * Build a `<title>` string with the brand suffix appended.
 *
 * pageTitle()                    -> "Sparkling Silver"
 * pageTitle("Cart")              -> "Cart — Sparkling Silver"
 * pageTitle("Cart", "Sparkling") -> "Cart — Sparkling" (custom suffix)
 *
 * If `page` already ends with the suffix (e.g. loader-provided text that
 * was pre-formatted), it's returned unchanged so we never double-append.
 */
export function pageTitle(page?: string | null, brand: string = BRAND): string {
  const trimmed = (page ?? "").trim();
  if (!trimmed) return brand;
  const suffix = `${SEPARATOR}${brand}`;
  if (trimmed === brand || trimmed.endsWith(suffix)) return trimmed;
  return `${trimmed}${suffix}`;
}

/**
 * Build a Sparkling Silver product/category title:
 *   sectionTitle("Bangles", "Antique") -> "Bangles — Antique — Sparkling Silver"
 */
export function sectionTitle(...parts: Array<string | null | undefined>): string {
  const clean = parts.map((p) => (p ?? "").trim()).filter(Boolean);
  return pageTitle(clean.join(SEPARATOR));
}
