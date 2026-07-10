## Goal

Recreate the exact look of your 4 reference screenshots for 10 antique previews (then the full batch after you approve):

- Jewellery in tack-sharp focus, rich metal + gemstone detail.
- Sitting on the original **black velvet bust / stand** from the source photo.
- **Dark green velvet backdrop** (~`#0E3A2E`, matches references).
- **SPARKLING SILVER logo** in the **top-right corner**, small and white, matching the reference lockup.

No transparent PNG. No LANCZOS. No v6 recipe.

## Source

`ANTIQUE-2.zip` (just re-uploaded, `user-uploads://ANTIQUE-2.zip`) — extract to `/tmp/antique-src/` and work off the raw originals only.

## Pipeline (Real-ESRGAN based)

For each raw JPEG:

1. Open raw file from the zip. Never touch already-enhanced copies.
2. **Real-ESRGAN 4× SR** with `RealESRGAN_x4plus` (general photo model — best for metal + gemstone; not the anime variant).
3. If long edge > 4000 px after 4×, downscale to 4000 px with area resample (not LANCZOS) so we keep the SR gain.
4. `rembg` `isnet-general-use` on the SR image → alpha matte around the jewellery **and the black velvet bust together** (mask keeps the stand so the piece still sits on its original support).
5. Soften matte edge with Gaussian σ ≈ 0.8.
6. **Composite over the studio background**:
   - Base: dark green velvet backdrop `#0E3A2E`, rendered once to `/tmp/velvet-bg.jpg` (tileable velvet + subtle grain + soft vignette) and reused for every image so all 845 share the exact same backdrop.
   - The bust + jewellery cutout is centred over the backdrop, preserving the original scale.
7. **Overlay the Sparkling Silver logo** in the top-right:
   - Use the white lockup from `/mnt/user-uploads/SPARKLING_SILVER_LOGO*.png` (I'll pick the cleanest white-on-transparent version).
   - Width ≈ 12% of image width, ~40 px inset from top and right, 90% opacity.
8. Save JPEG q95, 4:4:4 chroma.

Nothing from the old v6 recipe (LANCZOS, UnsharpMask, ivory background) is used.

## Steps

1. Extract `ANTIQUE-2.zip` → `/tmp/antique-src/`.
2. Install `realesrgan` + weights (`RealESRGAN_x4plus.pth`).
3. Render `/tmp/velvet-bg.jpg` once.
4. Pick the white Sparkling Silver logo file from uploads.
5. Run the pipeline on the same 10 SKUs already in preview (BJ-03, BNG-118, BT-99, BRC-21, BR-03, CH-108, ER-100, RG-01, JH-257, LS-608) — like-for-like comparison.
6. Write to `/mnt/documents/antique-preview-10-esrgan/` as JPEGs.
7. Stop and wait for your sign-off before running the remaining ~835.

## Runtime

- 10 previews: ~5–10 min on CPU.
- Full 845 (Phase 2 only after approval): ~2–4 h with 4 parallel workers, resume-safe.

## Not in scope

No database, admin panel, or app UI changes. Image production only — re-importing the enhanced set into the app is a separate step after you sign off on quality.
