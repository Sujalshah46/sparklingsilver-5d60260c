## Goal
Make every product image on the site paint near-instantly (blurred placeholder < 100ms, sharp image within one frame of arrival), without changing any layout, card, or design.

## Where we are today
- Supabase render/image transform already wired via `productThumbUrl` + `productLqipUrl` (`src/lib/product-images.ts`).
- Service Worker already caches product image responses (stale-while-revalidate).
- Catalogue currently uses `limit(120)` and renders all in one page — no pagination/virtualization.
- Homepage plays `sparkling-video-8.mp4` (~38 MB). No `poster`, `preload="metadata"` unclear.
- No `srcset` on some card / admin surfaces; product detail already has srcset.
- No `fetchpriority`/`sizes` audit on homepage carousel / category tiles.

The main real wins left are: (1) enforce the transform + srcset + lazy on **every** `<img>` that renders a product photo, (2) paginate catalogue, (3) fix the homepage video, (4) add a `?fmt=webp`/format hint and long cache header on the transform URL, (5) run a pilot batch before touching anything else.

## Plan

### Phase 1 — Pilot (must approve before Phase 2)
1. Pick 10 representative SKUs (mix: heavy antique long-set, plain bangle, CZ tops pair, belt, pendant, choker) and generate a side-by-side preview page at `/admin/image-quality-preview` (admin-only) showing, per SKU:
   - Original (untransformed signed URL)
   - Card thumb (w=400 q=75 webp)
   - Detail (w=1200 q=80 webp)
   - LQIP (w=24 q=20)
   - File sizes for each variant
2. Ship only this preview page. No site-wide changes yet. Wait for explicit approval.

### Phase 2 — Delivery layer (site-wide, no DB changes)
Apply the approved variant recipe by upgrading `productThumbUrl` / `productLqipUrl` only:
- Default `quality=75`, add `format=webp` (Supabase transform supports it via `format=origin` fallback; if unsupported by our tier we omit and rely on q=75 gain).
- Add helpers `productCardUrl(400)`, `productDetailUrl(1200)`, `productZoomUrl(original)` for clarity.
- Sweep every `<img>` that renders a product photo and enforce:
  - `srcset` at 300 / 600 / 900 for cards, 800 / 1200 / 1600 for detail.
  - `sizes` matching the grid columns.
  - `loading="lazy"` + `decoding="async"` on everything except the first 2 tiles of homepage & catalogue (kept `fetchpriority="high"`).
  - LQIP background via CSS `background-image` on the wrapper — paints in one packet, sharp image cross-fades in.
- Files touched: `src/components/CatalogueCard.tsx`, `src/components/HeroSlider.tsx`, `src/components/CategoryTile.tsx`, `src/routes/product.$slug.tsx`, admin lists (`admin/products.index.tsx`, `admin/inventory.tsx`, `admin/homepage-featured.tsx`) — admin stays on 96–128px thumbs (already done, verify).
- Zoom/lightbox on product detail keeps the untouched original URL — quality unchanged.

### Phase 3 — Catalogue pagination
- Change `/catalogue` from `.limit(120)` to a paged query (page size 30) using TanStack Query's `useInfiniteQuery`.
- Sentinel div + `IntersectionObserver` triggers `fetchNextPage`.
- Keep filter/sort UI identical; filters run server-side on the paged query.
- No visual change — same grid, same cards.

### Phase 4 — Homepage video
- Compress `sparkling-video-8.mp4` (H.264 1080p, ~2 Mbps target, ~5–8 MB) via ffmpeg; re-upload via `lovable-assets create` and swap the pointer.
- Add `poster` (a WebP still from frame 0) and `preload="metadata"`.
- Wrap the `<video>` in an IntersectionObserver so `src` is only attached once it scrolls into view.

### Phase 5 — Caching headers
- Confirm Supabase render/image responses carry `cache-control: public, max-age=31536000, immutable`. If not, append `&download=` cache-buster only when the underlying SKU image is replaced (we already version with `?v=...` on re-uploads — that's cache-safe).
- Extend SW cache limit + verify hit-rate in the network panel.

### Phase 6 — Upload pipeline (admin)
- On new upload in `admin/inventory.import.tsx` / product create, downscale originals > 3 MB with a browser-side canvas (or reject with a clear error suggesting the pipeline).
- No pre-generated variant files needed — the transform endpoint already handles per-request sizing, backed by Supabase's cache.

## Rollout gate
- Phase 1 preview → approval → Phases 2–6 shipped in one batch.
- No SKU images are re-uploaded or replaced. This is purely a delivery + rendering change; original files in Storage are untouched.

## Acceptance
- Every product `<img>` uses `srcset`+`sizes`, lazy except LCP, and a transformed URL.
- Catalogue paginates at 30/page.
- Homepage video < 10 MB with poster and lazy attach.
- Pilot 10 SKUs approved before rollout.
- No visual/layout regression.

Reply **"approve pilot"** to ship Phase 1 (the admin preview page) so you can eyeball quality on 10 SKUs before I touch the rest of the site.
