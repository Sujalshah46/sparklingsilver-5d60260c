# Faster product image on SKU open

## Why it's slow today
On the catalogue/home grid, each tile loads a **300 px thumbnail** through Supabase's image transform (~15–40 KB, cached by the Service Worker).

When you tap a SKU, the product detail page (`src/routes/product.$slug.tsx`) requests the **original full-resolution image** (`image_url` as-is → 2048×2048, often 1–2 MB). This URL is different from the thumbnail URL, so:

- The Service Worker cache doesn't help (different cache key).
- The browser has to download the full file over the network before it can paint.
- No `srcSet`, no `<link rel="preload">`, no hover/tap prefetch.

Result: 1–3 seconds of blank grey square after tapping.

## Fix (frontend only, no image regen)

1. **Serve a right-sized image on the detail page**
   Use `productThumbUrl(rawSrc, { width: 800, quality: 70 })` for the main tag and add a `srcSet` at 800w / 1200w / 1600w with `sizes="(min-width:768px) 640px, 100vw"`. Drops payload from ~1.5 MB to ~80–150 KB on mobile.

2. **Instant paint from cache — LQIP swap**
   Render the same 300 px thumbnail URL the grid just used as the initial `src` (already sitting in the SW cache → paints in < 50 ms), then swap to the high-res version once it decodes. User sees the product immediately instead of a grey square.

3. **Preload the detail image from the card**
   On `pointerenter` / `touchstart` of a `CatalogueCard` link, kick off a low-priority `fetch()` for the 800 w detail URL. By the time the route transition finishes, the image is already in the HTTP cache.

4. **`<link rel="preload" as="image" imagesrcset=…>` in the route `head()`**
   TanStack `head()` on `/product/$slug` emits a preload for the 800 w detail URL derived from loader data, so the browser starts the download in parallel with the JS/CSS for the route.

5. **Extend the Service Worker cache to the resized detail URLs**
   `public/sw.js` already caches `/storage/v1/render/image/…`. Confirm the new 800 w URLs match that pattern (they do) so a second visit to the same SKU is instant.

6. **Decoding hints**
   `decoding="async"`, `fetchpriority="high"` on the detail `<img>`, and drop the fade-in transition so paint isn't delayed one frame.

## Files to touch

- `src/routes/product.$slug.tsx` — swap `<img>` for LQIP → hi-res, add `srcSet` / `sizes` / preload in `head()`.
- `src/components/CatalogueCard.tsx` — add `onPointerEnter` / `onTouchStart` prefetch of the detail-size URL on the `<Link>`.
- `public/sw.js` — no change expected; verify pattern match.

## Expected result
- First tap on a SKU: image visible in **< 200 ms** (cached thumbnail LQIP) and sharp within **300–800 ms** on 4G (was 1.5–3 s).
- Repeat visits: **instant** from Service Worker cache.
- No image regeneration, no database changes, no impact on look/quality.
