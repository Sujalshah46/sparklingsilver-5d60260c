## Inventory Management — Admin Panel

Adds a full inventory section so admins can track and manage product stock.

### Schema changes (one migration)
- Add to `public.products`:
  - `stock_quantity` (integer, default 0, not null)
  - `low_stock_threshold` (integer, default 5, not null)
- Backfill: existing in-stock products → `stock_quantity = 10`; out-of-stock → `0`.
- Add admin-only RLS policies on `products` for UPDATE (existing policy is read-only for anon/authenticated).
- Trigger: auto-sync `in_stock = (stock_quantity > 0)` on update.

### New routes
- `/admin/inventory` — main inventory list
  - Search by name/SKU, filter by category, filter chip: All / Low stock / Out of stock
  - Each row: image, name, SKU, category, current qty, low-stock threshold, status badge
  - Inline +/− qty stepper with debounced save (optimistic update)
  - "Edit" opens a sheet for threshold + bulk adjust (set/add/subtract with reason note)
- `/admin/inventory/$id` — product stock detail (optional drill-in)
  - Current qty, threshold, in-stock toggle override
  - Recent stock changes (last 20 — from new `stock_movements` table)

### Stock movements log (audit trail)
- New table `public.stock_movements`:
  - `product_id`, `delta` (int), `reason` (text), `previous_qty`, `new_qty`, `created_by`, `created_at`
- Inserted automatically by an `adjustStock` server function on every change.
- Read-only for admins.

### Server functions (`src/lib/inventory.functions.ts`)
- `adjustStock({ product_id, delta, reason })` — atomic update + movement log
- `setStock({ product_id, quantity, reason })` — absolute set
- `updateThreshold({ product_id, low_stock_threshold })`
- All gated with `requireSupabaseAuth` + `has_role('admin')` check.

### Dashboard integration
- Add a "Low stock" stat card on `/admin` (count of products at/below threshold).
- New Quick Action tile: "Inventory" (links to `/admin/inventory`, badge = low-stock count).

### Customer-side effect
- Product cards & detail page show "Only N left" warning when stock ≤ threshold.
- "Add to Cart" disabled when `stock_quantity = 0`.
- Order placement decrements stock atomically (server-side, inside `placeOrder`).

### Technical notes
- Realtime subscription on `products` table in `/admin/inventory` so concurrent admins see live updates.
- Uses TanStack Query optimistic updates for the stepper to feel instant.
- All mutations go through server functions — never direct client writes to stock fields.

### Files touched
- New: `supabase/migrations/...` (schema + RLS + trigger)
- New: `src/lib/inventory.functions.ts`
- New: `src/routes/_authenticated/admin/inventory.tsx`
- New: `src/routes/_authenticated/admin/inventory.$id.tsx`
- Edit: `src/routes/_authenticated/admin/index.tsx` (low-stock card + quick action)
- Edit: `src/lib/orders.functions.ts` (decrement stock on order placement)
- Edit: product card + product detail components (low-stock warning, disabled CTA)
