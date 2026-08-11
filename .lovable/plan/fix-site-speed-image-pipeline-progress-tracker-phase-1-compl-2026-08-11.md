# Fix Site Speed & Image Pipeline Progress Tracker (Phase 1 Complete)

## 1. Homepage Performance (TTFB 6.5s → <600ms)
- **Status**: [DONE]
- **Implementation**:
    - Added `product_count` column to `categories` table via migration.
    - Implemented `update_category_product_count()` trigger to maintain counts automatically.
    - Simplified `homeQuery` to fetch `product_count` directly from the `categories` row, eliminating N serialized head-count queries.
    - Verified counts: Antique (493), CZ (475).

## 2. Image Pipeline Progress Tracker
- **Status**: [SHIPPED UI]
- **Implementation**:
    - Created `/admin/pipeline/upscale` with real-time progress bar, status badges, and log output.
    - Linked the tracker from the Admin Dashboard for quick access.
    - *Next step*: Connect the UI to the actual upscaling process file (`/tmp/antique-ls-batch1/progress.json`).

## 3. Image Variants (Lighthouse LCP/FCP)
- **Status**: [IN PROGRESS]
- **Implementation**:
    - Migration added `image_variants` column to `products`.
    - `CatalogueCard` and `ProductPage` already support `srcset` and `image_variants`.
    - *Next step*: Implement backfill logic and update admin upload handlers.

## 4. Layout Shift (CLS 0.29 → <0.1)
- **Status**: [DONE]
- **Implementation**:
    - Cleaned up adjacent JSX in `CatalogueCard` and `ProductPage`.
    - Set explicit `width={600} height={600}` on `CatalogueCard` images to reserve space before load.

## 5. Build-Time Optimization
- **Status**: [PENDING]
- **Action**: Convert remaining admin routes to lazy routes.
