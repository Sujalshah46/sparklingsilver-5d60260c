---
name: jewelry-image-pipeline
description: Sparkling Silver locked pipeline for upscaling jewelry product photos with Lovable AI, overlaying the brand logo top-right without overlapping the subject, and syncing SKU + gross weight from an uploaded Excel sheet into the products table so the web app renders them. Use whenever the user asks to enhance, upscale, re-render, or bulk-process product images for any category (necklace, long set, matil, bangles, tika/tikka, tops, etc.).
---

# Jewelry Image Pipeline (Sparkling Silver)

Locked, approved recipe. Do NOT invent alternatives (no Real-ESRGAN, no LANCZOS, no ivory bg, no baked-in text captions).

## Rules (non-negotiable)

1. **Upscale**: Lovable AI via `imagegen--edit_image` model=`premium`, output **1920x1920** (Lovable's max). Prompt keeps the exact original metal color/tone and places the piece on an **opaque dark green velvet** backdrop (`#0E3A2E`), subject centered, with headroom in the top-right corner reserved for the logo so the logo never overlaps the jewellery.
2. **Pairs rule for earrings / tops**: when the source SKU is a pair product (for example Tops), the generated image must show **both earrings** together. Never output only one earring unless the source itself is intentionally a single-piece product.
3. **Logo overlay** (PIL, after upscale): white Sparkling Silver lockup from `/mnt/user-uploads/SPARKLING_SILVER_LOGO*.png`, **top-right corner**, width = **14% of image width**, opacity **90%**, inset ~40px from top and right. Must NOT overlap the subject — if it does, re-run the edit prompt with more top-right negative space; do not shrink or move the logo.
4. **No baked-in text**. Never render SKU, weight, price, or captions onto the pixels. Those belong in the database only.
5. **Save**: JPEG quality 95, 4:4:4 chroma subsampling.
6. **Excel sync**: user uploads an .xlsx with at minimum `SKU` and `Gross Weight` columns (accept common variants: `sku`, `Item Code`, `gross_weight`, `Gross Wt`, `GW`). For each processed image, match by SKU and UPDATE `public.products` setting `gross_weight` (numeric grams). Never overwrite `price`, `making_charge`, `gst`, or other pricing fields (see mem://preferences/no-auto-pricing). Product `name` stays as-is unless user asks; SKU is the join key, not something to write onto the image.
7. **Upload**: put files in `product-images/<category>/<subcategory>/<sku>.jpg`, upsert, then set `products.image_path` + `products.image_url` + `has_image = true` for the matched SKU row.
8. **Quick bulk app workflow**: for category batches already prepared in the uploaded zip, prefer the fast workflow used for Long Set / Necklace / Pendant Set:
   - parse the Excel first
   - bulk insert any missing product rows into `public.products` with category/subcategory/SKU/name/gross_weight and safe defaults
   - upload all processed JPGs to storage paths in one batch
   - call `/api/public/admin-bulk-link-images` with `x-cron-secret` and a payload of `{ items: [{ sku, storage_path }] }`
   - let that endpoint create signed URLs and update `image_url`, `image_path`, `has_image=true`
   - verify with a read query that the rows are visible in the app
9. **Pricing safety**: the bulk insert step must leave `price` untouched unless the user explicitly gives prices. If a new row must be created, use `0` or existing safe defaults only for placeholder required fields — never auto-calculate commercial pricing.

## Steps

1. Extract source zip to `/tmp/<batch>-src/`. Only touch raw originals.
2. Parse the category Excel with pandas and normalize columns.
3. For each raw image, call `imagegen--edit_image` with:
   - `model: "premium"`, `width: 1920`, `height: 1920`
   - prompt for single-piece categories: `"Studio product photo of this exact jewellery piece on an opaque dark green velvet backdrop (#0E3A2E). Preserve the original metal color and gemstone tones exactly — do not recolor. Center the piece with generous empty space in the TOP-RIGHT corner reserved for a logo (do not place any part of the jewellery in the top-right ~18% of the frame). Soft studio lighting, sharp focus, subtle vignette, no text, no watermark, no props."`
   - prompt for pair categories such as Tops: `"Studio product photo of this exact pair of earrings on an opaque dark green velvet backdrop (#0E3A2E). Preserve the original metal color and gemstone tones exactly — do not recolor. Show BOTH earrings together, centered, with generous empty space in the TOP-RIGHT corner reserved for a logo. Soft studio lighting, sharp focus, subtle vignette, no text, no watermark, no props."`
4. Overlay logo with PIL (see `scripts/overlay_logo.py`).
5. Save JPEG q95 subsampling=0.
6. **Fast batch route**:
   - insert all missing product rows in one bulk DB operation
   - upload all JPGs to `product-images/<category>/<subcategory>/<sku>.jpg`
   - POST the whole list once to `/api/public/admin-bulk-link-images`
7. Sync `gross_weight` from Excel by SKU if not already applied during insert.
8. Verify with a read query that each row shows the new image + gross_weight.

## Excel parsing

```python
import pandas as pd, re

df = pd.read_excel(path, header=6)

def norm(c): return re.sub(r'[^a-z0-9]', '', c.lower())
cols = {norm(c): c for c in df.columns}
sku_col = cols.get('sku') or cols.get('itemcode') or cols.get('code')
gw_col  = cols.get('grossweight') or cols.get('grosswt') or cols.get('gw') or cols.get('weight')
item_col = cols.get('item')
family_col = cols.get('family')
design_col = cols.get('designno') or cols.get('design')
assert sku_col and gw_col, f"Need SKU + Gross Weight columns; got {list(df.columns)}"
rows = [
  {
    'sku': str(r[sku_col]).strip(),
    'gross_weight': float(r[gw_col]),
    'item': str(r[item_col]).strip() if item_col and pd.notna(r[item_col]) else None,
    'family': str(r[family_col]).strip() if family_col and pd.notna(r[family_col]) else None,
    'design_no': str(r[design_col]).strip() if design_col and pd.notna(r[design_col]) else None,
  }
  for _, r in df.iterrows()
  if pd.notna(r[sku_col]) and pd.notna(r[gw_col])
]
```

## Bulk insert shape

Use one bulk operation for all missing rows. Safe default row shape:

```sql
sku,
name = '<Category label> <Subcategory label> ' || sku,
category_id,
subcategory_id,
metal = 'silver',
purity = '925',
gross_weight,
net_weight = 0,
making_charge_pct = 12,
price = 0,
moq = 1,
stock_quantity = 10,
low_stock_threshold = 5,
item,
family,
has_image = false,
import_status = 'active'
```

If the SKU already exists, do not duplicate it.

## Bulk link endpoint

Canonical endpoint already in app:

- `POST /api/public/admin-bulk-link-images`
- header: `x-cron-secret: <CRON_SECRET>`
- body:

```json
{
  "items": [
    { "sku": "AR(TK)-34", "storage_path": "antique/tikka/AR(TK)-34.jpg" },
    { "sku": "AR(TP)-01", "storage_path": "antique/tops/AR(TP)-01.jpg" }
  ]
}
```

This endpoint signs the storage URL and updates `products.image_url`, `products.image_path`, and `has_image`.

## Logo overlay (canonical)

See `scripts/overlay_logo.py`. Copy to /tmp before running.

## References

- mem://features/image-upscale-pipeline — original locked recipe
- mem://preferences/no-auto-pricing — never compute/overwrite pricing
- mem://preferences/preserve-jewelry-color — retain exact metal tone
