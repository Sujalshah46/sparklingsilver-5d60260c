# Fix Site Speed & Image Pipeline Progress Tracker

Implementation of Lighthouse-driven performance optimizations and a visible progress tracker for the Antique Long Set upscaling batch.

## 1. Homepage Performance (TTFB 6.5s → <600ms)
- **Problem**: Homepage `homeQuery` serializes category fetches and product count queries.
- **Action**: Add `product_count` to `categories` table and implement a trigger for real-time updates.
- **Action**: Cache `homeQuery` results for 5 minutes.
- **Action**: Move blocking Supabase reads out of loaders into `useSuspenseQuery`.

## 2. Image Pipeline Progress Tracker
- **Requirement**: Add a visible progress tracker showing which Antique Long Set SKUs are pending, processing, completed, or failed.
- **Implementation**: 
    - Create a new admin page `/admin/pipeline/upscale` specifically for tracking the current upscaling batch.
    - The page will display:
        - Overall progress bar.
        - List of all target SKUs with status badges: `Pending`, `Processing`, `Completed`, `Failed`.
        - Real-time logs from the upscaling process (polled from a progress file or local storage).
        - Audit results (pass/fail) for each SKU.
    - Integration: Link to this tracker from the Admin Dashboard and the Image Backfill page.

## 3. Upload-Time Image Variants (Lighthouse LCP/FCP)
- **Requirement**: Support multiple resolutions (300w, 600w, 1200w) to improve loading speed.
- **Implementation**:
    - Update `products` table with `image_variants` JSONB column.
    - Update admin upload flow to generate and upload variants.
    - Update `productThumbUrl` etc. to prefer variants.
    - Implement backfill admin page (resumable, progress-tracked).

## 4. Layout Shift (CLS 0.29 → <0.1)
- **Implementation**: Set explicit aspect ratios and dimension attributes on `CatalogueCard` images.

## 5. Build-Time Optimization
- **Implementation**: Convert admin sub-pages to lazy routes to reduce initial bundle size.

## Technical Details

### Database Changes
```sql
ALTER TABLE public.categories ADD COLUMN product_count int DEFAULT 0;

-- Trigger to keep count updated
CREATE OR REPLACE FUNCTION update_category_product_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
    UPDATE categories SET product_count = product_count - 1 WHERE id = OLD.category_id;
    UPDATE categories SET product_count = product_count + 1 WHERE id = NEW.category_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_count
AFTER INSERT OR DELETE OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_category_product_count();

-- Initial sync
UPDATE categories c
SET product_count = (SELECT count(*) FROM products p WHERE p.category_id = c.id);

ALTER TABLE public.products ADD COLUMN image_variants jsonb;
```

### New Tracker Component
- Path: `src/routes/_authenticated/admin/pipeline.upscale.tsx`
- Features: Batch monitoring, retry logic for failed SKUs, audit log view.
