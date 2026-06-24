## SEO Plan — Sparkling Jewellers LLP

Goal: get every public page indexable, uniquely titled, structured, and shareable, then layer in content + Google Search Console.

### 1. Crawlability foundation
- Create `public/robots.txt` (allow all, reference sitemap).
- Create `src/routes/sitemap[.]xml.ts` server route listing: `/`, `/catalogue`, `/contact`, `/gold-rate`, `/search`, every `/category/$slug` (from `categories` table), every `/product/$slug` (from `products` table where `is_active`). Exclude `/auth`, `/_authenticated/*`, `/notifications`.
- Create `public/llms.txt` summarizing the brand + linking public pages.

### 2. Per-route metadata (head())
Replace the generic root-inherited meta on every leaf with unique `title` (≤60 chars), `description` (120–160 chars), `og:title`, `og:description`, `og:url`, and self-referencing `canonical`.

| Route | Title |
|---|---|
| `/` | "Sparkling Jewellers LLP — Premium Indian Jewellery" |
| `/catalogue` | "Shop Gold & Diamond Jewellery — Sparkling Jewellers" |
| `/category/$slug` | "{Category} — Sparkling Jewellers" (from loader) |
| `/product/$slug` | "{Product Name} — {SKU} | Sparkling Jewellers" (dynamic from loaderData) |
| `/contact` | "Contact Sparkling Jewellers — Visit, Call, WhatsApp" |
| `/gold-rate` | "Today's Gold Rate — 22K & 18K | Sparkling Jewellers" |
| `/search` | "Search Jewellery — Sparkling Jewellers" + `noindex` |

Root `__root.tsx`: keep only sitewide defaults (`charSet`, `viewport`, `og:site_name`, `og:type: website`). Remove the leaf-overriding og:image so product pages can supply their own.

### 3. Structured data (JSON-LD)
- `__root.tsx` → `WebSite` + `Organization`/`JewelryStore` (name, url, logo, address, telephone, sameAs).
- `/` → `JewelryStore` with full NAP from contact page.
- `/product/$slug` → `Product` (name, image, description, sku, brand, offers{price, priceCurrency: INR, availability}).
- `/category/$slug` → `CollectionPage` + `BreadcrumbList`.
- `/contact` → `LocalBusiness` with geo + opening hours if available.

### 4. On-page content & accessibility
- Add a visible `<h1>` to `/` ("Sparkling Jewellers — Premium Indian Gold & Diamond Jewellery") and `/catalogue` ("Shop Our Jewellery Collection").
- Add `aria-label="Save to wishlist"` on the wishlist icon button in `product.$slug.tsx`.
- Ensure product/category pages render product `alt` text from product name.
- Add internal links: home → top categories; category → related categories; product → "You may also like".

### 5. Content marketing (blog)
- Add a `blog` route group: `/blog` index + `/blog/$slug` dynamic.
- Seed first 3 articles targeting high-intent Indian jewellery queries:
  1. "How to Calculate Gold Jewellery Price in India" (making charges, GST, purity).
  2. "22K vs 18K Gold — Which Should You Buy?"
  3. "Hallmarking & BIS Certification Explained".
- Each post: `Article` JSON-LD, og:image, canonical, breadcrumbs.

### 6. Performance for SEO (Core Web Vitals)
- Preload LCP hero image on `/` via `head().links` (`rel=preload`, `as=image`, `fetchpriority=high`).
- Add `width`/`height` + `loading="lazy"` (except LCP) on all product/category images.
- Convert bundled hero/product images via `vite-imagetools` to AVIF/WebP.

### 7. Google Search Console
- Connect GSC via `standard_connectors--connect` (google_search_console).
- Verify ownership of `https://cuddly-code-gen.lovable.app`.
- Submit `/sitemap.xml`.

### 8. Verification
- Run SEO rescan; mark resolved findings via `update_findings`.
- Validate with Google Rich Results Test on `/` + a product page.

### Execution order (next turns)
1. robots.txt + sitemap.xml + llms.txt + root JSON-LD cleanup.
2. Per-route head() upgrades + canonical/og:url + Product/Collection JSON-LD.
3. H1s + wishlist aria-label.
4. Blog scaffold + 3 seed articles.
5. LCP preload + image lazy-loading.
6. GSC connect + sitemap submit.
7. Rescan + mark findings fixed.

Want me to execute all 7 steps, or start with steps 1–3 (the technical SEO core) and queue the blog + GSC for a follow-up?
