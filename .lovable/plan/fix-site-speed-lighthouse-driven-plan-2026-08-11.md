# Fix Site Speed — Lighthouse-Driven Plan

Four confirmed issues from real Lighthouse audits. Fix in priority order.

## 1. Homepage server response (6.5s → <600ms) [HIGHEST]

The homepage `head()` renders fast, but `homeQuery` runs a categories fetch + **N head-count queries per category** in sequence-of-parallel, plus a featured-products fetch. This is client-side already, so 6.5s TTFB points at **edge/SSR cold-start + serialized round-trips**.

Actions:
- Replace per-category `head:true` count queries with a **single RPC** or a cached materialized value stored on the `categories` row (`product_count` int, updated by trigger on `products` insert/update/delete). One query instead of 1 + N.
- Confirm `src/routes/index.tsx` has no `loader` (it doesn't — good). Verify `__root.tsx` doesn't block on auth network calls during SSR; the auth gate should be a client-only script (already is).
- Add `staleTime: 5 * 60_000` on `homeQuery` so navigations back to `/` are instant.
- Check `/category/$slug` and `/category/$slug/$sub` loaders — move any Supabase reads out of the loader into `useSuspenseQuery` in the component so the HTML shell streams immediately.

## 2. Supabase image transforms not resizing [HIGHEST]

Live-tested: `?width=300` still returns 2048×2048. The add-on is **not available in Lovable Cloud's UI** (confirmed with user last turn). Option 1 is off the table.

Actions (Option 2 — upload-time variants):
- Migration: add `image_variants jsonb` on `products` (`{thumb: url, card: url, detail: url}`).
- Update admin upload flow (`src/routes/_authenticated/admin/*`) to generate 3 WebPs at upload time (300w/600w/1200w, q=75) using browser `canvas`/`createImageBitmap`, upload all three to storage, store URLs in `image_variants`.
- Update `productThumbUrl()` / `productCardUrl()` / `productDetailUrl()` in `src/lib/product-images.ts` to prefer `image_variants[size]` when present, fall back to current passthrough URL.
- Wire `srcset` in `CatalogueCard` and product detail to use the variant URLs.
- Build a **one-time backfill admin page** at `/admin/image-backfill`: paginates through all ~2000 products missing variants, downloads original, generates 3 WebPs client-side, uploads, updates row. Resumable, progress bar, batch size 20.

## 3. Fix layout shift (CLS 0.29 → <0.1) [MEDIUM]

Product cards jump as images load.

Actions:
- In `CatalogueCard.tsx`, wrap the `<img>` in a container with explicit `aspect-ratio: 1/1` (product images are square) and `width:100%`. Set `width` and `height` attributes on the `<img>` element itself (e.g. `width={600} height={600}`) so the browser reserves space before load.
- Apply the same to product detail hero and any grid using `ProductImage`.

## 4. Trim unused JS (639 KiB) [LOW]

Actions:
- Audit `src/routes/__root.tsx` and `src/routes/index.tsx` for eager imports that belong in admin-only or product-detail-only routes (admin components, chart libs, heavy form libs).
- Convert admin dashboard sub-pages to lazy routes (`.lazy.tsx`) where they aren't already.
- Check if any large icon set (`lucide-react`) is being imported wholesale anywhere — only named imports.
- Deprioritize until #1–#3 are shipped and re-measured.

## Verification

After each section:
- **#1**: measure homepage TTFB with `curl -o /dev/null -s -w '%{time_starttransfer}\n' https://sparklingsilver.lovable.app/`
- **#2**: `curl -sI <thumb-url> | grep -i content-length` should show tens of KB, not hundreds. Verify on homepage + `/category/antique/long-set`.
- **#3**: Chrome DevTools Performance → CLS metric on a category page.
- **#4**: Compare `dist/assets/index-*.js` sizes before/after.
- Final: fresh Lighthouse on homepage AND category page, share vs baseline (0.71 / 0.62).

## Order of execution

1. Ship #3 first (small, isolated, immediate UX win).
2. Ship #1 (migration + trigger + query simplification).
3. Ship #2 (biggest surface area — migration, upload flow, backfill page, srcset rewiring). Approve at pilot page before running full backfill.
4. Ship #4 last after re-measuring — may already be acceptable.

## Callouts

- **#2 will re-encode ~2000 images.** Since variants are derived from the current 2048×2048 hero (not from raw source), the v7 pipeline output, logo overlays, and bust framing are preserved. No visual regression risk on the displayed variant sizes.
- If Lovable Cloud later exposes Image Transformations as a toggle, we can remove the variant system and revert to URL params — the fallback in `productThumbUrl()` makes that a one-line change.
