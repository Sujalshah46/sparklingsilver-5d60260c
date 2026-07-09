## Confirmation of what's in the zip

- Top-level folder: `ANTIQUE/` → this is the **collection/category** name
- **15 category folders** (matches your spec): BAJU, BANGLE, BELT, BRACELET, BRIDAL, CHOKER, EARRINGS, FINGER RING, JHUMKA, LONG SET, MATIL, NECKLACE, PENDANT SET, TIKKA, TOPS
- One `.xlsx` per folder, ~845 image files, ~200MB total
- SKU column joins to `{SKU}.jpg` filenames exactly

## Reuse existing schema, don't build a parallel one

Your app already has the right tables. I'll map onto them instead of creating new `collections`/`categories`/`products` tables that duplicate what's there:

| Your spec           | Existing table                          | Notes                                        |
|---------------------|-----------------------------------------|----------------------------------------------|
| Collection "ANTIQUE"| `categories` row **"Antique"**          | Already exists                               |
| Category folder     | `subcategories` row (BANGLE, NECKLACE…) | All 15 already seeded from earlier turns     |
| SKU row             | `products` row                          | `products.sku` unique, matches your key rule |

The existing `products` table already has `sku`, `metal`, `purity`, `gross_weight`, `net_weight`, `image_url`, `category_id`, `subcategory_id`, `stock_quantity`, etc. I only need to add a few audit/status columns.

Note: your app's `collections` table is a separate concept (Bridal / Daily Wear / Festival / Office Wear — style groupings), so I'll **leave it alone**. When you later add e.g. a "TEMPLE" zip, it becomes another **category** ("Temple"), not a collections row.

## Migration (single migration, reviewed before running)

Add to `products`:
- `design_no text`
- `item text`, `family text` (raw audit fields from the sheet)
- `image_path text` (storage object path, nullable)
- `has_image boolean not null default false`
- `import_status text not null default 'active'` — `active` | `missing_image` | `archived`
- Make `image_url` **nullable** (currently NOT NULL) so rows can exist without a photo
- Make `price` default `0` and `name` default to SKU when unspecified (B2B; price is computed from weight × silver rate elsewhere)
- Index on `import_status`

New storage bucket: **`product-images`** (private; served via signed URLs like `category-images` already is). Path convention `antique/bangle/AR(BNG)-100.jpg`. Overwriting a path bumps `updated_at` so URLs can be cache-busted with `?v=updated_at`.

## One-time backfill (run from the sandbox, not the browser)

I already have `SUPABASE_SERVICE_ROLE_KEY` in the sandbox, so I'll run a Python script that:

1. Extracts `ANTIQUE.zip` to `/tmp`
2. For each of the 15 folders:
   - Finds the single `.xlsx`, scans column A until it hits the literal header `SKU`, then reads rows until the first blank
   - For each row: reads `SKU / Item / Family / METAL / DESIGN NO / G-WT / N-WT`
   - Looks for `{SKU}.jpg|jpeg|png|webp` (case-insensitive, exact SKU match, no fuzzy)
   - Uploads found images to `product-images/antique/{subcategory-slug}/{SKU}.{ext}` via service role
   - Upserts the `products` row on `sku` conflict (safe to re-run)
3. Prints a summary: created / updated / missing-image SKUs / parse failures with raw row data

Expected numbers per your prompt: ~919 rows, ~105 missing images (NECKLACE 71, LONG SET 13, PENDANT SET 7, others near zero).

## In-app admin surfaces (built after the backfill)

- **Products admin** already exists (`/admin/products`) — extend the filter panel with a "Missing images" toggle (`import_status = 'missing_image'`) and show a replace-image button on the row detail page.
- **New import screen** at `/admin/products/import` — accepts a small per-category zip (spreadsheet + folder of images) and reuses the exact same parse/match/upsert logic from the backfill script, exposed as a `createServerFn` that streams the summary back. This is the right shape for ongoing updates — a 200 MB zip is a one-time backfill, not the everyday flow.

## Rules for future edit requests (as you spelled out)

Every edit is resolved by exact SKU:
- "Set gross weight for `AR(BNG)-100` to 55" → `UPDATE products SET gross_weight=55 WHERE sku='AR(BNG)-100'`
- "Replace image for `AR(BT)-108`" → re-upload same storage path, bump `updated_at`
- "Archive `AR(NK)-336`" → `import_status='archived'`
- "Add new SKU to BANGLE" → same upsert path
- Bulk category re-import → re-run the category step of the importer

## Order of execution (once you approve)

1. Migration: add columns + `product-images` bucket + policies (I'll show you the SQL for approval)
2. Run backfill script from sandbox, print summary
3. Wire the "Missing images" filter and per-row image replace into the existing admin
4. Add the `/admin/products/import` screen for future collections

**Anything to change before I start?** In particular:
- OK with mapping "ANTIQUE" → your existing **Antique** category (rather than a brand-new `collections` table)?
- OK to make `image_url` nullable and default `price` to 0 so imported rows are valid?
- OK to leave your existing `collections` table (Bridal/Daily Wear/…) untouched — it's a different concept from your zip-level "collection"?
