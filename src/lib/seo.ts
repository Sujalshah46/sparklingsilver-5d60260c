/**
 * SEO title + description templates — single source of truth for the site's
 * brand string and the shape of meta tags emitted by every route.
 *
 * All route `head()` titles MUST go through `pageTitle()` and all descriptions
 * MUST go through `pageDescription()` (typically via `descriptionTags()`).
 * That way the brand name lives in exactly one place, and any legacy "LLP"
 * suffix that sneaks in from a copy-paste, database field, or old fixture is
 * scrubbed before it ever reaches a `<meta>` tag.
 */

export const BRAND = "Sparkling Silver" as const;
export const SITE_ORIGIN = "https://sparklingsilver.in" as const;

/**
 * Fallback description used when a route (or loader-provided text) resolves
 * to an empty string. Also acts as the default social/OG description on
 * pages that don't ship their own copy.
 */
export const DEFAULT_DESCRIPTION =
  "Sparkling Silver — premium 925 sterling silver jewellery. Antique and CZ collections crafted for weddings, festivals and everyday wear.";

const SEPARATOR = " — ";
const MAX_DESCRIPTION_LENGTH = 160;

/**
 * Strip any stray "LLP" that appears next to the brand name. Matches
 * "Sparkling Silver LLP", "Sparkling Silver Jewellers LLP", "SparklingSilverLLP",
 * and bare "LLP" tokens. Runs on every title and description so a legacy
 * value in the database or an accidental hardcode can never resurface.
 */
function stripLegacyBrandSuffix(input: string): string {
  return input
    // "Sparkling Silver LLP" / "Sparkling Silver Jewellers LLP" / "Sparkling Jewellers LLP"
    .replace(/(sparkling(?:\s+\w+)*?)\s+llp\b/gi, "$1")
    // Any remaining bare "LLP" token (with or without surrounding punctuation)
    .replace(/\s*\bllp\b\.?/gi, "")
    // Collapse whitespace introduced by the removals
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

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
  const trimmed = stripLegacyBrandSuffix((page ?? "").trim());
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

/**
 * Normalise a meta description:
 *   - strip legacy "LLP" suffix
 *   - collapse whitespace / newlines from CMS/loader content
 *   - clamp to the ~160 char Google preview limit (word-safe, adds an ellipsis)
 *   - fall back to DEFAULT_DESCRIPTION when the input is empty
 *
 * pageDescription("Sparkling Silver LLP — antique silver bangles.")
 *   -> "Sparkling Silver — antique silver bangles."
 */
export function pageDescription(text?: string | null, fallback: string = DEFAULT_DESCRIPTION): string {
  const cleaned = stripLegacyBrandSuffix((text ?? "").replace(/\s+/g, " ").trim());
  const base = cleaned || fallback;
  if (base.length <= MAX_DESCRIPTION_LENGTH) return base;
  const clipped = base.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).replace(/[,.;:\-–—\s]+$/, "")}…`;
}

/**
 * Emit `<meta name="description">`, `<meta property="og:description">` and
 * `<meta name="twitter:description">` in a single spread so every page uses
 * the same shape and passes through `pageDescription()` sanitisation.
 *
 *   head: () => ({ meta: [{ title }, ...descriptionTags(rawDesc)] })
 */
export function descriptionTags(
  text?: string | null,
  opts: { fallback?: string; twitter?: boolean } = {},
): Array<{ name?: string; property?: string; content: string }> {
  const content = pageDescription(text, opts.fallback);
  const tags: Array<{ name?: string; property?: string; content: string }> = [
    { name: "description", content },
    { property: "og:description", content },
  ];
  if (opts.twitter !== false) tags.push({ name: "twitter:description", content });
  return tags;
}
