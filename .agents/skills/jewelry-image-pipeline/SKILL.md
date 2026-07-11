---
name: jewelry-image-pipeline
description: Sparkling Silver locked pipeline for upscaling jewelry product photos with Lovable AI, overlaying the brand logo top-right without overlapping the subject, and syncing SKU + gross weight from an uploaded Excel sheet into the products table so the web app renders them. Use whenever the user asks to enhance, upscale, re-render, or bulk-process product images for any category (necklace, long set, matil, bangles, etc.).
---

# Jewelry Image Pipeline (Sparkling Silver)

Locked, approved recipe. Do NOT invent alternatives (no Real-ESRGAN, no LANCZOS, no ivory bg, no baked-in text captions).

## Rules (non-negotiable)

1. **Upscale**: Lovable AI via `imagegen--edit_image` model=`premium`, output **1920x1920** (Lovable's max). Prompt keeps the exact original metal color/tone and places the piece on an **opaque dark green velvet** backdrop (`#0E3A2E`), subject centered, with headroom in the top-right corner reserved for the logo so the logo never overlaps the jewellery.
2. **Logo overlay** (PIL, after upscale): white Sparkling Silver lockup from `/mnt/user-uploads/SPARKLING_SILVER_LOGO*.png`, **top-right corner**, width = **14% of image width**, opacity **90%**, inset ~40px from top and right. Must NOT overlap the subject — if it does, re-run the edit prompt with more top-right negative space; do not shrink or move the logo.
3. **No baked-in text**. Never render SKU, weight, price, or captions onto the pixels. Those belong in the database only.
4. **Save**: JPEG quality 95, 4:4:4 chroma subsampling.
5. **Excel sync**: user uploads an .xlsx with at minimum `SKU` and `Gross Weight` columns (accept common variants: `sku`, `Item Code`, `gross_weight`, `Gross Wt`, `GW`). For each processed image, match by SKU and UPDATE `public.products` setting `gross_weight` (numeric grams). Never overwrite `price`, `making_charge`, `gst`, or other pricing fields (see mem://preferences/no-auto-pricing). Product `name` stays as-is unless user asks; SKU is the join key, not something to write onto the image.
6. **Upload**: put files in `product-images/<category>/<subcategory>/<sku>.jpg`, upsert, then set `products.image_path` + `products.image_url` (30-yr signed URL) + `has_image = true` for the matched SKU row.

## Steps

1. Extract source zip to `/tmp/<batch>-src/`. Only touch raw originals.
2. For each raw image, call `imagegen--edit_image` with:
   - `model: "premium"`, `width: 1920`, `height: 1920`
   - prompt: `"Studio product photo of this exact jewellery piece on an opaque dark green velvet backdrop (#0E3A2E). Preserve the original metal color and gemstone tones exactly — do not recolor. Center the piece with generous empty space in the TOP-RIGHT corner reserved for a logo (do not place any part of the jewellery in the top-right ~18% of the frame). Soft studio lighting, sharp focus, subtle vignette, no text, no watermark, no props."`
3. Overlay logo with PIL (see `scripts/overlay_logo.py`).
4. Save JPEG q95 subsampling=0.
5. Upload to storage bucket `product-images` at `<category>/<subcategory>/<sku>.jpg` with upsert.
6. Parse the uploaded Excel with pandas; for each SKU, run a Supabase migration/update linking `image_url`, `image_path`, `has_image=true`, and `gross_weight` from the sheet. Do NOT touch pricing columns.
7. Verify with `supabase--read_query` that the row shows the new image + gross_weight.

## Excel parsing

```python
import pandas as pd, re
df = pd.read_excel(path)
def norm(c): return re.sub(r'[^a-z0-9]', '', c.lower())
cols = {norm(c): c for c in df.columns}
sku_col = cols.get('sku') or cols.get('itemcode') or cols.get('code')
gw_col  = cols.get('grossweight') or cols.get('grosswt') or cols.get('gw') or cols.get('weight')
assert sku_col and gw_col, f"Need SKU + Gross Weight columns; got {list(df.columns)}"
rows = [(str(r[sku_col]).strip(), float(r[gw_col])) for _, r in df.iterrows() if pd.notna(r[sku_col]) and pd.notna(r[gw_col])]
```

## Logo overlay (canonical)

See `scripts/overlay_logo.py`. Copy to /tmp before running.

## References

- mem://features/image-upscale-pipeline — original locked recipe
- mem://preferences/no-auto-pricing — never compute/overwrite pricing
- mem://preferences/preserve-jewelry-color — retain exact metal tone
