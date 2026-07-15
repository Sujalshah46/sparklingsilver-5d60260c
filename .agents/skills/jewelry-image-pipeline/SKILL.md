---
name: jewelry-image-pipeline
description: Sparkling Silver locked pipeline for upscaling jewelry product photos with Lovable AI, overlaying the brand logo top-right without overlapping the subject, and syncing SKU + gross weight from an uploaded Excel sheet into the products table so the web app renders them. Use whenever the user asks to enhance, upscale, re-render, or bulk-process product images for any category (necklace, long set, matil, bangles, tika/tikka, tops, belt, choker, jhumka, etc.).
---

# Jewelry Image Pipeline (Sparkling Silver)

Locked, approved recipe. Do NOT invent alternatives (no Real-ESRGAN, no LANCZOS, no ivory bg, no baked-in text captions).

## Rules (non-negotiable)

1. **Upscale**: Lovable AI via `imagegen--edit_image` model=`premium`, output **1920x1920** (Lovable's max). Prompt keeps the exact original metal color/tone and places the piece on a **fully uniform emerald green velvet** backdrop (`#0E5A3E` for CZ / long sets, `#0E3A2E` for antique — always confirm which category the batch belongs to). The velvet must extend edge-to-edge with **no reserved logo box, no rectangular patch, no shade variation, no watermark placeholder, no blurred square in any corner**. Subject centered and front-facing on its bust.
2. **Pairs rule for earrings / tops**: when the source SKU is a pair product (for example Tops), the generated image must show **both earrings** together. Never output only one earring unless the source itself is intentionally a single-piece product.
3. **Logo overlay is applied ONLY in the PIL post-step, never by the AI model.** Do NOT ask the model to reserve space, leave headroom, or draw a logo — that produces the blurred top-right square/patch artifact. Instead the AI prompt asks for a fully uniform emerald backdrop, and the PIL overlay drops the white Sparkling Silver lockup from `/mnt/user-uploads/SPARKLING_SILVER_LOGO*.png` in the **top-right corner**, width = **14% of image width**, opacity **90%**, inset ~40px from top and right. The PIL step is mandatory on every generated frame — never ship a raw generated image without running `overlay_logo.py` over it.
4. **No baked-in text**. Never render SKU, weight, price, or captions onto the pixels. Those belong in the database only.
5. **Save**: JPEG quality 95, 4:4:4 chroma subsampling.
6. **Excel sync**: user uploads an .xlsx with at minimum `SKU` and `Gross Weight` columns (accept common variants: `sku`, `Item Code`, `gross_weight`, `Gross Wt`, `GW`). For each processed image, match by SKU and UPDATE `public.products` setting `gross_weight` (numeric grams). Never overwrite `price`, `making_charge`, `gst`, or other pricing fields (see mem://preferences/no-auto-pricing). Product `name` stays as-is unless user asks; SKU is the join key, not something to write onto the image.
7. **Upload + link (SIMPLE PIPELINE — PREFERRED)**: this is the workflow that actually works reliably for every category (CZ Matil, CZ Belt, and the antique batches). Skip the admin bulk-link endpoint and any admin panel UI. Do everything directly with the service role key from a local Python script:
   - Upload each processed JPG to `product-images/<category>/<subcategory>/<sku>.jpg` via Storage REST (`POST /storage/v1/object/product-images/...` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `x-upsert: true`, `content-type: image/jpeg`).
   - Mint a long-lived signed URL for each object (`POST /storage/v1/object/sign/product-images/<path>` with body `{"expiresIn": 946080000}` ≈ 30 years). The response gives a relative `signedURL`; prepend `${SUPABASE_URL}/storage/v1` to store the full absolute URL.
   - PATCH the matching product row by SKU via PostgREST (`PATCH /rest/v1/products?sku=eq.<sku>` with headers `apikey`, `Authorization: Bearer <service-role>`, `Content-Type: application/json`, `Prefer: return=minimal`) setting `image_url`, `image_path`, `has_image=true`.
   - No edge function, no `/api/public/admin-bulk-link-images` call, no admin UI upload. If the SKU row does not exist yet, insert it first (see Bulk insert shape) — same PostgREST endpoint with POST.
8. **Pricing safety**: never touch `price`, `making_charge_pct`, `gst`, etc. If a new row must be created, use `0` or existing safe defaults only for required placeholder fields — never auto-calculate commercial pricing.

## Prompt templates (locked)

Use these verbatim. They were derived from repeatedly fixing the exact failure modes below.

- **Neck-worn piece (necklace, long set, choker, bridal) — REQUIRES A VISIBLE EMERALD VELVET BUST:**
  `"Studio product photo of this exact necklace mounted on a tall EMERALD GREEN VELVET NECK BUST (mannequin-style shoulders + neck stand fully covered in emerald green velvet #0E5A3E for CZ / #0E3A2E for antique). The bust silhouette MUST be clearly visible behind the necklace — do NOT let the piece float in mid-air, and the bust MUST be emerald green velvet, NOT black, NOT gold, NOT beige, NOT marble. The backdrop is completely uniform emerald green velvet filling the ENTIRE frame edge-to-edge with NO shade variation, NO reserved logo area, NO rectangular patch or box in any corner, NO watermark, NO placeholder, NO blurred square. Preserve original metal color and gemstone tones exactly. Center front-facing. Soft studio lighting, sharp focus, subtle vignette. No text, no props."`
- **Flat piece (matil, belt, pendant, tika, bangle):** same locked emerald backdrop, no bust required — just `"...on a completely uniform emerald green velvet backdrop..."` (older single-piece phrasing works).
- **Pair (tops, earrings, jhumka):** same emerald backdrop, add "this exact pair of earrings ... Show BOTH earrings together, centered."

Do NOT add phrases like "reserve space for logo", "leave the top-right blank", "headroom for a watermark" — those cues make the model paint a blurred rectangle. The logo lives only in the PIL overlay step.

## Post-generation audit (mandatory before shipping)

After generating a batch, run these checks with PIL on every `final/*.jpg`. Regenerate any SKU that fails, then re-run overlay + upload for it.

1. **Bust color check**: sample a strip along the bottom-center where the bust sits and require the dominant hue to be emerald green (H≈140-165, S>25, V>15 in HSV). Flag near-black, grey, beige, or golden busts and regenerate.
2. **Top-right patch check**: crop the top-right ~18% of the frame, compute local color variance / edge density vs the rest of the backdrop. A blurred rectangular box shows up as a low-variance patch with a hard edge; regenerate any SKU that trips this.
3. **Logo-presence check**: count near-white pixels (R,G,B > 235) inside the top-right 18% box. A properly overlaid logo returns > ~2000 white pixels at 1920x1920. Zero white pixels means the overlay step was skipped — re-run `overlay_logo.py` on that file.
4. **Uniform backdrop check**: sample the four corners; all four should be within ΔE ≈ 15 of the target emerald hex. Large deltas mean the model painted a gradient or reserved area.

Keep the audit script per-batch under `/tmp/<batch>-src/audit.py`. Do not declare a batch done until 0 SKUs are flagged.

## Steps

1. Extract source zip to `/tmp/<batch>-src/`. Only touch raw originals.
2. Parse the category Excel with pandas and normalize columns.
3. For each raw image, call `imagegen--edit_image` with `model: "premium"`, `width: 1920`, `height: 1920`, using the locked prompt above.
4. Overlay logo with PIL (see `scripts/overlay_logo.py`) — MANDATORY on every generated frame.
5. Save JPEG q95 subsampling=0.
6. Run the post-generation audit (bust color, top-right patch, logo presence, uniform backdrop). Regenerate + re-overlay any flagged SKU until the audit is clean.
7. **Simple link route** (canonical — use this every time):
   - Ensure product rows exist (PostgREST POST for missing SKUs; see Bulk insert shape).
   - Upload every JPG to `product-images/<category>/<subcategory>/<sku>.jpg` via Storage REST with the service role key.
   - Sign each object for ~30 years and PATCH the `products` row by SKU with `image_url`, `image_path`, `has_image=true`.
8. Sync `gross_weight` from Excel by SKU (PATCH) if not already applied during insert.
9. Verify with a read query that each row shows the new image + gross_weight, then load the category page in the web app to confirm the tiles render.

## Known failure modes (learned the hard way — do not repeat)

- **Blurred square/rectangle in top-right corner**: caused by prompting the model to "reserve space" or "leave headroom" for a logo. Fix: use the locked prompt (no reservation language) and rely on the PIL overlay. Re-audit and regenerate any SKU with a top-right patch.
- **Non-emerald bust (black, grey, beige, gold)**: model reverted the stand to the source photo's tone. Fix: prompt explicitly says "completely uniform emerald green velvet edge-to-edge, front-facing bust". Detect via HSV bottom-center sample and regenerate.
- **Missing logo on shipped images**: happens when the AI-generated file is uploaded directly without running `overlay_logo.py`. Fix: pipeline is `gen/<sku>.jpg -> overlay -> final/<sku>.jpg -> upload`. Upload only from `final/`. Audit with white-pixel count in the top-right box.
- **Shipping the batch before auditing**: every past fix cycle came from skipping the audit. The audit is not optional — run it before telling the user the batch is done.

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

See `scripts/overlay_logo.py`. Copy to /tmp before running. Never skip this step; upload only from the `final/` directory it writes to.

## References

- mem://features/image-upscale-pipeline — original locked recipe
- mem://preferences/no-auto-pricing — never compute/overwrite pricing
- mem://preferences/preserve-jewelry-color — retain exact metal tone
