## Overview

Add admin control for **New Arrival** / **Bestseller** tagging (already partially wired via `is_new` + `is_bestseller`) and a new **Homepage New Arrival** selector that hand-picks up to 10 SKUs, in a chosen order, for the homepage carousel.

## 1. Database (migration)

Add to `public.products`:
- `homepage_featured boolean NOT NULL DEFAULT false`
- `homepage_featured_order integer NULL`
- Partial unique index on `homepage_featured_order` where `homepage_featured = true` (keeps ordering clean)
- Trigger enforcing max 10 rows with `homepage_featured = true` (raise exception on 11th)
- Trigger: when a product is soft-archived (`import_status <> 'active'`) or deleted, auto-clear its `homepage_featured` + `homepage_featured_order`
- Index on `(homepage_featured, homepage_featured_order)` for the homepage query

Keep existing columns as-is:
- `is_new` = "New Arrival" tag (already exists, already default false)
- `is_bestseller` = "Bestseller" tag (already exists)

## 2. Admin — Product list (`/admin/products`)

File: `src/routes/_authenticated/admin/products.index.tsx`
- Add two inline checkbox toggles per row: **New Arrival** (`is_new`) and **Bestseller** (`is_bestseller`)
- Optimistic update via a `toggleProductFlag` server fn; invalidate list query on success
- Header summary: `X SKUs tagged New Arrival · Y SKUs tagged Bestseller` (single count server fn)

The existing product edit page (`products.$id.tsx`) already has both toggles — leave it.

## 3. Admin — Homepage New Arrival selector (new route)

File: `src/routes/_authenticated/admin/homepage-featured.tsx` (linked from admin nav)
- Two-panel layout:
  - **Left:** searchable product list (reuse product tile: image, SKU, gross wt, purity) with a "Feature on Homepage" checkbox per row.
  - **Right:** the currently selected up-to-10 SKUs as a reorderable list (up/down arrow buttons — simpler than DnD, matches request's fallback).
- Live counter: `Selected: N / 10`. When `N === 10`, disable unchecked checkboxes and show `You've selected 10/10 SKUs. Uncheck one to add another.`
- Buttons: **Clear All**, **Preview** (opens modal that renders the actual homepage carousel component with the selected 10 in order).
- Server fns:
  - `getHomepageFeatured()` — list of the ≤10 selected, ordered
  - `setHomepageFeatured({ productId, featured })` — insert/remove; assigns next-available order on add; enforces cap (backend + DB trigger)
  - `reorderHomepageFeatured({ orderedIds: string[] })` — rewrites `homepage_featured_order` 1..N
  - `clearHomepageFeatured()`
- All server fns use `requireSupabaseAuth` + admin role check (existing `has_role` pattern).

## 4. Homepage

File: `src/routes/index.tsx`
- Replace the current "new arrival / bestseller mixed" query with a dedicated fetch: `products where homepage_featured = true order by homepage_featured_order asc limit 10`.
- If 0 selected, hide the section (buyer-facing) but keep the section header + "not configured" note visible only to admins.
- Card design unchanged.

## 5. Catalogue filters

File: `src/routes/category.$slug.$sub.tsx` (and any equivalent modal wiring)
- Confirm the "New Arrivals only" checkbox filters by `is_new` (currently uses `is_new` — verify variable name in filter state; rename UI label if needed to "New Arrivals only").
- "Bestsellers only" filters by `is_bestseller` (already wired).
- Both applied together = AND. Already the case.

## 6. Edge cases

- 11th selection: DB trigger raises exception → server fn returns friendly error → UI toast.
- Product delete/archive → trigger clears `homepage_featured` automatically.
- `is_new` untagged on a homepage-featured SKU → no side effect (independent).

## Technical notes

- Uses existing `has_role(auth.uid(), 'admin')` for RLS on new columns (admin-only UPDATE); public SELECT already covers products.
- No new tables. All changes on `products`.
- Reuse existing shadcn `Checkbox`, `Button`, `Badge`, `Dialog`, `Input` — no new components in the design system.
- No re-deploy needed after admin toggle — queries hit Supabase live and homepage query has `staleTime: 0` (or add `router.invalidate()` after admin changes).

## File touchlist

- **New migration**: 2 columns + 2 triggers + index
- **Edit** `src/routes/index.tsx` — swap homepage query
- **Edit** `src/routes/_authenticated/admin/products.index.tsx` — inline toggles + summary
- **New** `src/routes/_authenticated/admin/homepage-featured.tsx`
- **New** `src/lib/homepage-featured.functions.ts` (server fns)
- **Edit** admin nav (`_authenticated/admin/route.tsx` or index) to link the new page
- **Verify** `src/routes/category.$slug.$sub.tsx` filter wiring; adjust label if needed