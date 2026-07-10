## Goal
Get the jewelry in each output image as sharp as (or sharper than) the original zip source — no blur, crisp facets/stones/engraving — while keeping the clean studio background.

## Why v5 looked blurry
- v5 ran 2 sequential 4× super-resolution passes on a luminance-cropped jewelry region. Cascading SR on an already-upscaled image hallucinates soft texture instead of recovering detail, and the luminance bbox often clipped edges, so the SR model saw a partial subject and smoothed it.
- We also never compared against the raw source at 100% — the "upscale" was fighting an input that was already high-res, so the model had nothing new to add and just softened edges.
- Final unsharp mask was applied globally after SR, which amplified SR's smooth artifacts instead of the real edges.

## New pipeline (v6) — quality-first, single pass

```text
original.jpg (from zip, untouched)
   │
   ├─► 1. Load at full native resolution. No pre-resize, no pre-crop.
   │
   ├─► 2. Detect jewelry mask (not bbox):
   │       rembg (u2net / isnet-general-use) → alpha matte
   │       → gives pixel-accurate subject vs background
   │
   ├─► 3. Background: replace with clean neutral (match existing look)
   │       using the matte, feather 2px.
   │
   ├─► 4. Jewelry region only:
   │       a. Real-ESRGAN x4plus (or x2plus if source ≥ 2000px)
   │          - single pass, tile=512, fp32
   │       b. GFPGAN is skipped (faces only, would distort metal)
   │       c. Light detail boost: PIL UnsharpMask(radius=1.2, percent=110, threshold=3)
   │          applied ONLY inside the matte, not globally
   │
   ├─► 5. Recomposite jewelry over clean background at full res.
   │
   └─► 6. Export JPEG quality=95, 4:4:4 chroma, no downscale.
           Target long edge ≥ max(3000 px, 1.5× source long edge).
```

## Key differences vs v5
| Aspect | v5 (blurry) | v6 (this plan) |
|---|---|---|
| SR passes | 2 cascaded 4× | 1 pass, Real-ESRGAN |
| SR model | super-image EDSR-ish | Real-ESRGAN x4plus (state-of-art for photos) |
| Region | luminance bbox (clips) | rembg alpha matte (pixel-accurate) |
| Sharpening | global, post-SR | masked, subtle, edge-aware |
| Background | kept from crop | cleanly replaced via matte |
| Compare loop | none | side-by-side vs source before accepting |

## Deliverables
- `run_v6.py` written to sandbox with the pipeline above, resume-safe (`if out exists: skip`).
- Runs on all 20 source images from the original zip (not on v5 outputs — v5 is discarded as an input).
- Outputs in `/mnt/documents/pilot-v6/v6_1.jpg … v6_20.jpg`.
- After the first 2 images finish, I pause and show you `v6_1.jpg` and `v6_2.jpg` next to the originals so you confirm sharpness is right before spending compute on the remaining 18.

## Dependencies to install
- `realesrgan` + `basicsr` + `torch` (CPU build; ~5 min install)
- `rembg[cpu]` with `u2net` model (first run downloads ~170 MB)
- `Pillow`, `numpy` (already present)

## Runtime estimate
~90–150 s per image on CPU for Real-ESRGAN x4 at tile=512 + rembg. 20 images ≈ 30–50 min total. I'll poll every 2 min and report progress, same cadence as before.

## Open questions before I build
1. Do you still have the **original zip** available in the sandbox, or should I ask you to re-upload it? v6 must run on the untouched originals, not on v4/v5 outputs.
2. Background: keep the exact off-white studio look the current images have, or switch to pure white / transparent PNG?
3. OK to spend ~30–50 min compute on all 20, or do you want me to stop after the 2-image checkpoint and wait for your approval before continuing?
