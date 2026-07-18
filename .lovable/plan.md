## Goal
Make product images appear effectively instantly (perceived <100 ms) on homepage, category, subcategory, product detail, and admin lists — without changing image content or overlays.

> Note: true 0.1–0.2 ms is below a single network round‑trip. What we can guarantee is **instant paint** using cached/precomputed thumbs + a colored placeholder that swaps to the sharp image within one frame (<100 ms) on repeat views, and 200–500 ms on cold loads.

## Root causes today
1. **Same Supabase render endpoint hit per visit** — every card triggers a signed on‑the‑fly resize (300 px + 600 px 2x) on Supabase's image transformer. First hit per size is slow (~400–900 ms) and it isn't aggressively edge‑cached because signed URLs vary per session.
2. **No CDN in front of images** — served straight from Supabase Storage, no Cloudflare cache, no immutable URLs.
3. **No blurred placeholder** — cards show a grey pulse until the full image arrives, so "loading" is visible.
4. **Admin lists request the full‑size image**, not a thumb.
5. **No preloading** of the next viewport's images or of homepage hero thumbs.
6. **Service worker** caches only a few assets, not product thumbs.

## Fix plan

### 1. Precompute and store two fixed thumbnail sizes per product (biggest win)
- On upload / relink, generate `thumb-320.webp` (grid) and `thumb-800.webp` (detail) into the `product-images` bucket next to the original.
- Store `thumb_url` and `detail_url` columns on `products`.
- Serve those static public URLs — no signed render call, fully cacheable.
- One‑time backfill script for existing ~970 SKUs.

### 2. Put Cloudflare in front of the storage bucket
- Route thumbs through `cdn.sparklingsilver.in` (Cloudflare Worker proxy) with `Cache-Control: public, max-age=31536000, immutable`.
- First user in a region warms cache; every subsequent user gets ~20–60 ms edge hits.

### 3. Tiny LQIP (base64, ~400 bytes) inlined in the DB row
- Column `lqip` = 24 px blurred WebP base64.
- Card shows it instantly as `background-image`; sharp thumb fades in on top. Zero perceived load.

### 4. Card + admin table tweaks
- `CatalogueCard`: use `thumb_url` (no runtime `productThumbUrl` rewrite), keep `srcSet` only if a 2× exists; replace the grey pulse with the LQIP.
- Admin `products.index.tsx`: switch full images to `thumb_url` (currently loads originals).
- Homepage hero carousel: `<link rel="preload" as="image">` for slide 1 only.
- First row of any grid: `priority` + `fetchpriority="high"`; rest lazy.

### 5. Service worker: cache thumbs
- Add a runtime cache rule for `/product-images/**thumb-*.webp` — stale‑while‑revalidate, cap 300 entries. Repeat visits paint from disk (<10 ms).

### 6. Cleanup
- Drop `productThumbUrl` render‑endpoint calls once thumbs exist.
- Keep original full image only for product zoom.

## Rollout (one turn each)
1. Migration: add `thumb_url`, `detail_url`, `lqip` columns + indexes; make bucket public‑read for thumbs only.
2. Server fn + script to generate thumbs + LQIP for all existing products; backfill.
3. Update upload/link pipeline to emit thumbs on every future image.
4. Swap `CatalogueCard`, product detail, admin lists, homepage carousel to new columns; add LQIP background; add preload for hero.
5. Update `public/sw.js` with SWR cache for thumbs.
6. Optional: Cloudflare Worker CDN in front of storage (requires DNS change — I'll flag before doing).

## Expected result
- Repeat visit / warm CDN: **10–50 ms** to paint sharp thumb.
- Cold visit: LQIP paints in first frame (<50 ms), sharp thumb swaps in 150–400 ms.
- Admin lists: ~10× less bytes per row.

## Technical notes
- Thumb generation via `sharp` runs in a Node script locally (not in the Cloudflare Worker runtime — Worker doesn't support sharp). Output uploaded via `supabaseAdmin`.
- WebP q75 for 320 px (~8 KB), q78 for 800 px (~35 KB).
- LQIP = 24 px WebP q30, base64 (~350–500 bytes), stored inline.
- No changes to image content, logo overlay, or emerald‑velvet pipeline — this is a delivery‑layer change only.

Approve and I'll start with step 1 (migration + backfill script).