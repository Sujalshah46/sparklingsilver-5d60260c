# Site Speed Fixes — Lighthouse Audit Response

Three prioritized fixes based on the audit. Each has a concrete change and a verification step.

---

## 1. Kill the 6.5s server response (highest priority)

**Root cause (confirmed in code):** `src/routes/index.tsx` runs a `loader` that awaits three Supabase queries (`categories`, featured `products`, and a full `products` scan for counts) *during SSR* before any HTML is sent. On a cold Cloudflare Worker this easily produces the ~6.5s document latency the audit reports. Every other route with a loader has the same shape.

**Changes:**
- **Homepage:** remove the SSR loader. Convert `homeQuery` to client-only `useSuspenseQuery` inside the component (or `useQuery` + skeleton) so the HTML shell is returned immediately and Supabase runs in the browser in parallel with the JS bundle.
- **Category counts query:** replace the "fetch every product row just to count" scan with a single grouped count (RPC or `select('category_id', { count: 'exact', head: true })` per category, run in parallel). This is the heaviest query in the loader.
- **Audit other public routes** (`catalogue`, `category.$slug.*`, `product.$slug`) — for each: keep the loader only if it's cheap and cached; otherwise drop to client-fetch with suspense. Protected `_authenticated/*` routes already gate on auth so no change needed.
- **Add HTTP cache headers** on the SSR response for public routes (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`) so repeat/edge hits skip the render entirely.

**Verify:** rerun Lighthouse; target `document-latency` < 600ms. Also check TTFB in DevTools Network on a hard reload.

---

## 2. Supabase image transformations returning originals

**Investigation first (before code changes):**
- Confirm from a Network panel screenshot that a request like `.../render/image/sign/...?width=440&quality=55` returns `content-length` ≈ full original (300–700KB) and `content-type: image/jpeg` unchanged. Check response headers for any Supabase error hint.
- Image Transformations is a paid Supabase add-on. On Lovable Cloud this may not be enabled on the current plan. **I'll report back which case applies** before doing large work here.

**If transforms are enabled but the URL shape is wrong:** fix the rewrite in `src/lib/product-images.ts` (`productThumbUrl`) — verify `render/image/sign` vs current SDK's expected path.

**If transforms are unavailable (plan limit):** flag it to you and implement the fallback:
- Add a one-time backfill job (admin route) that, for each existing product image, generates three fixed variants (`thumb-300.webp`, `card-600.webp`, `detail-1200.webp`) via `sharp`-equivalent (Worker-safe: use `@cf-wasm/photon` or an edge image API) and stores them alongside the original in the same bucket.
- Update the upload pipeline in `admin/products` and `admin/inventory.import` to write the three variants at upload time going forward.
- Change `productThumbUrl` / `CatalogueCard` to point at the pre-sized variant matching the requested width instead of appending transform params.

**Verify:** homepage product image transfer size in DevTools drops to ~20–60KB per card.

---

## 3. Trim unused JavaScript

Lower priority — do after #1 and #2 land and re-measure.

- Move admin-only imports out of shared chunks. Audit `src/routes/_authenticated/admin/*` for any util currently re-exported through a barrel that pulls admin code into the public bundle.
- Confirm `autoCodeSplitting` is doing its job per-route (it is on by default); the 79% unused on `client-*.js` suggests a shared vendor chunk with heavy libs used only on admin/checkout. Candidates to audit: `@dnd-kit/*`, chart libs, rich-text editors, `xlsx` — dynamic-import these inside the admin routes that use them instead of top-level import.
- Rebuild and re-run Lighthouse; check `unused-javascript` bytes.

---

## Out of scope (per your instructions — already correct)

Lazy-loading, `srcset`/`sizes`, WebP for pre-built assets. Not touching.

---

## Order of execution

1. Ship #1 (loader → client fetch + count query fix + cache headers). Re-measure.
2. Diagnose #2, report Supabase plan status, then either fix URL or build variant pipeline. Re-measure.
3. Ship #3 (dynamic-import admin-only deps). Re-measure and share final Lighthouse score.

Approve and I'll start with step 1.
