---
name: jewelry-image-pipeline
description: Sparkling Silver locked pipeline for upscaling jewelry product photos with Lovable AI, overlaying the brand logo top-right without overlapping the subject, and syncing SKU + gross weight from an uploaded Excel sheet into the products table so the web app renders them. Use whenever the user asks to enhance, upscale, re-render, or bulk-process product images for any category (necklace, long set, matil, bangles, tika/tikka, tops, belt, choker, jhumka, etc.).
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
7. **Upload + link (SIMPLE PIPELINE — PREFERRED)**: this is the workflow that actually works reliably for every category (CZ Matil, CZ Belt, and the antique batches). Skip the admin bulk-link endpoint and any admin panel UI. Do everything directly with the service role key from a local Python script:
   - Upload each processed JPG to `product-images/<category>/<subcategory>/<sku>.jpg` via Storage REST (`POST /storage/v1/object/product-images/...` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `x-upsert: true`, `content-type: image/jpeg`).
   - Mint a long-lived signed URL for each object (`POST /storage/v1/object/sign/product-images/<path>` with body `{"expiresIn": 946080000}` ≈ 30 years). The response gives a relative `signedURL`; prepend `${SUPABASE_URL}/storage/v1` to store the full absolute URL.
   - PATCH the matching product row by SKU via PostgREST (`PATCH /rest/v1/products?sku=eq.<sku>` with headers `apikey`, `Authorization: Bearer <service-role>`, `Content-Type: application/json`, `Prefer: return=minimal`) setting `image_url`, `image_path`, `has_image=true`.
   - No edge function, no `/api/public/admin-bulk-link-images` call, no admin UI upload. If the SKU row does not exist yet, insert it first (see Bulk insert shape) — same PostgREST endpoint with POST.
8. **Pricing safety**: never touch `price`, `making_charge_pct`, `gst`, etc. If a new row must be created, use `0` or existing safe defaults only for required placeholder fields — never auto-calculate commercial pricing.

## Steps

1. Extract source zip to `/tmp/<batch>-src/`. Only touch raw originals.
2. Parse the category Excel with pandas and normalize columns.
3. For each raw image, call `imagegen--edit_image` with:
   - `model: "premium"`, `width: 1920`, `height: 1920`
   - prompt for single-piece categories: `"Studio product photo of this exact jewellery piece on an opaque dark green velvet backdrop (#0E3A2E). Preserve the original metal color and gemstone tones exactly — do not recolor. Center the piece with generous empty space in the TOP-RIGHT corner reserved for a logo (do not place any part of the jewellery in the top-right ~18% of the frame). Soft studio lighting, sharp focus, subtle vignette, no text, no watermark, no props."`
   - prompt for pair categories such as Tops: `"Studio product photo of this exact pair of earrings on an opaque dark green velvet backdrop (#0E3A2E). Preserve the original metal color and gemstone tones exactly — do not recolor. Show BOTH earrings together, centered, with generous empty space in the TOP-RIGHT corner reserved for a logo. Soft studio lighting, sharp focus, subtle vignette, no text, no watermark, no props."`
4. Overlay logo with PIL (see `scripts/overlay_logo.py`).
5. Save JPEG q95 subsampling=0.
6. **Simple link route** (canonical — use this every time):
   - Ensure product rows exist (PostgREST POST for missing SKUs; see Bulk insert shape).
   - Upload every JPG to `product-images/<category>/<subcategory>/<sku>.jpg` via Storage REST with the service role key.
   - Sign each object for ~30 years and PATCH the `products` row by SKU with `image_url`, `image_path`, `has_image=true`.
7. Sync `gross_weight` from Excel by SKU (PATCH) if not already applied during insert.
8. Verify with a read query that each row shows the new image + gross_weight, then load the category page in the web app to confirm the tiles render.

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

Safe default row shape (used only when a SKU row does not already exist):

```
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

Never duplicate an existing SKU.

## Simple upload + link pipeline (Python, canonical)

Uses only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. This is the exact
shape that shipped CZ Matil and CZ Belt end-to-end.

```python
import os, requests, mimetypes, pathlib

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H_JSON = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

def upload(local_path: str, storage_path: str) -> None:
    with open(local_path, "rb") as f:
        r = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/product-images/{storage_path}",
            headers={
                "Authorization": f"Bearer {KEY}",
                "apikey": KEY,
                "x-upsert": "true",
                "content-type": mimetypes.guess_type(local_path)[0] or "image/jpeg",
            },
            data=f.read(),
        )
    r.raise_for_status()

def sign(storage_path: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/sign/product-images/{storage_path}",
        headers=H_JSON,
        json={"expiresIn": 946080000},  # ~30 years
    )
    r.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1{r.json()['signedURL']}"

def patch_product(sku: str, storage_path: str, signed_url: str) -> None:
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/products",
        headers={**H_JSON, "Prefer": "return=minimal"},
        params={"sku": f"eq.{sku}"},
        json={
            "image_url": signed_url,
            "image_path": storage_path,
            "has_image": True,
        },
    )
    r.raise_for_status()

def link_batch(category: str, subcategory: str, items: list[tuple[str, str]]) -> None:
    # items: [(sku, local_jpg_path), ...]
    for sku, local in items:
        storage_path = f"{category}/{subcategory}/{sku}.jpg"
        upload(local, storage_path)
        signed = sign(storage_path)
        patch_product(sku, storage_path, signed)
```

Do NOT reach for `/api/public/admin-bulk-link-images`, the `link-images` edge
function, or the admin panel image uploader. Those routes have failed in
practice (404s, missing secrets, RLS). The simple pipeline above is the one to
reuse for every remaining category.

## Logo overlay (canonical)

See `scripts/overlay_logo.py`. Copy to /tmp before running.

## References

- mem://features/image-upscale-pipeline — original locked recipe
- mem://preferences/no-auto-pricing — never compute/overwrite pricing
- mem://preferences/preserve-jewelry-color — retain exact metal tone
