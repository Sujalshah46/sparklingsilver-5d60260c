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

/* ------------------------------------------------------------------ */
/*  JSON-LD structured data                                            */
/* ------------------------------------------------------------------ */

/**
 * Recursively scrub every string in a JSON-LD payload through
 * `stripLegacyBrandSuffix` so an "LLP" that snuck in via a database
 * field, hardcoded value, or fixture never reaches a `<script>` tag.
 * Only strings are transformed — numbers, booleans and nested
 * objects/arrays are traversed but otherwise untouched.
 */
function scrubJsonLd<T>(value: T): T {
  if (typeof value === "string") return stripLegacyBrandSuffix(value) as unknown as T;
  if (Array.isArray(value)) return value.map(scrubJsonLd) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubJsonLd(v);
    return out as unknown as T;
  }
  return value;
}

type LdNode = Record<string, unknown>;

/**
 * Serialise one or more JSON-LD nodes into the `{ type, children }`
 * shape TanStack's `head().scripts` expects. Pass an array to stack
 * multiple schemas (e.g. Product + BreadcrumbList) into one route.
 *
 *   head: () => ({ scripts: [jsonLdScript(productSchema(...))] })
 *   head: () => ({ scripts: [jsonLdScript([articleSchema(...), breadcrumbSchema(...)])] })
 */
export function jsonLdScript(node: LdNode | LdNode[]): { type: "application/ld+json"; children: string } {
  const payload = Array.isArray(node) ? node.map(scrubJsonLd) : scrubJsonLd(node);
  return { type: "application/ld+json", children: JSON.stringify(payload) };
}

/** Sparkling Silver Organization node — safe to embed anywhere as a publisher/author. */
export function organizationSchema(): LdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.ico`,
  };
}

/** WebSite node with SearchAction. Root-level use only (one per site). */
export function websiteSchema(): LdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: SITE_ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_ORIGIN}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/** JewelryStore node — for the homepage and Contact page. */
export function jewelryStoreSchema(opts: {
  url?: string;
  image?: string;
  telephone?: string;
  email?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    postalCode?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
}): LdNode {
  const node: LdNode = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: BRAND,
    url: opts.url ?? SITE_ORIGIN,
  };
  if (opts.image) node.image = opts.image;
  if (opts.telephone) node.telephone = opts.telephone;
  if (opts.email) node.email = opts.email;
  if (opts.address) node.address = { "@type": "PostalAddress", ...opts.address };
  return node;
}

/** Product node for individual product pages. */
export function productSchema(opts: {
  name: string;
  sku?: string;
  image?: string;
  description?: string;
  url: string;
  price?: number | string;
  priceCurrency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
}): LdNode {
  const node: LdNode = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    url: opts.url,
    brand: { "@type": "Brand", name: BRAND },
  };
  if (opts.sku) node.sku = opts.sku;
  if (opts.image) node.image = opts.image;
  if (opts.description) node.description = opts.description;
  if (opts.price !== undefined) {
    node.offers = {
      "@type": "Offer",
      price: opts.price,
      priceCurrency: opts.priceCurrency ?? "INR",
      availability: `https://schema.org/${opts.availability ?? "InStock"}`,
      url: opts.url,
    };
  }
  return node;
}

/** Article node for blog posts. Author/publisher default to the brand Organization. */
export function articleSchema(opts: {
  title: string;
  description?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}): LdNode {
  const node: LdNode = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    mainEntityOfPage: opts.url,
    author: { "@type": "Organization", name: BRAND },
    publisher: {
      "@type": "Organization",
      name: BRAND,
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/favicon.ico` },
    },
  };
  if (opts.description) node.description = opts.description;
  if (opts.datePublished) node.datePublished = opts.datePublished;
  if (opts.dateModified) node.dateModified = opts.dateModified;
  if (opts.image) node.image = opts.image;
  return node;
}

/** CollectionPage node for category / subcategory listings. */
export function collectionPageSchema(opts: {
  name: string;
  description?: string;
  url: string;
}): LdNode {
  const node: LdNode = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: opts.url,
    isPartOf: { "@type": "WebSite", name: BRAND, url: SITE_ORIGIN },
  };
  if (opts.description) node.description = opts.description;
  return node;
}

/** BreadcrumbList node — pass ordered {name, url} items from home downward. */
export function breadcrumbSchema(items: Array<{ name: string; url: string }>): LdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
