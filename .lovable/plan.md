## No re-upload needed

`ANTIQUE.zip` is still in the sandbox at `/tmp/ANTIQUE.zip` (your original ~200 MB upload, 15 category folders, ~845 raw photos). I'll work off those untouched originals.

## Quality target

Same recipe that produced the 19 `v6_*` previews you approved (from `/tmp/fast_preview.py`):

1. `rembg` `isnet-general-use` → pixel-accurate alpha matte on the raw original
2. LANCZOS upscale to 3000 px on the long edge
3. Masked `UnsharpMask` (radius 1.6, amount 140%) applied **only inside the jewellery matte** — background stays clean
4. Mild contrast lift on the jewellery only
5. Composite over the soft ivory studio background `(245, 241, 234)` using a Gaussian-blurred alpha for clean edges
6. JPEG q95, 4:4:4 chroma

Nothing about that pipeline changes.

## Plan

**Phase 1 — 10-image preview (this step)**

1. Extract `/tmp/ANTIQUE.zip` → `/tmp/antique-src/`.
2. Pick **10 sample SKUs spread across categories** (so you see necklace, bangle, earrings, tikka, choker, etc. — not 10 from one folder).
3. Run the approved pipeline on those 10.
4. Export the enhanced 10 + their raw originals side-by-side to `/mnt/documents/antique-preview-10/` so you can compare.
5. Stop and wait for your **"yes, continue"** or feedback.

**Phase 2 — full batch (only after you approve)**

6. Run the same pipeline on all remaining ~835 images, resume-safe (skips anything already done).
7. Preserve folder + filename → `/tmp/antique-enhanced/<CATEGORY>/<SKU>.jpeg` so the SKU→file mapping stays intact for the later product import.
8. Summary log: total / done / failures.
9. Zip everything to `/mnt/documents/antique-enhanced.zip` for download / re-import.

## Runtime

- Phase 1 (10 images): ~1–2 minutes.
- Phase 2 (~835 images): ~1.5–2 hours on CPU. I can parallelise CPU workers (~3–4× faster) if you want — tell me and I'll enable it in phase 2.

## Not touched in this plan

- No DB / `products` table / `product-images` bucket / admin UI changes. This is image enhancement only. Re-importing the enhanced set into Lovable Cloud is a separate step after you sign off on quality.
