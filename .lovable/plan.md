# Sparkling Jewellers — Tanvi/Yug-style B2B Redesign

A full visual + UX overhaul. The current consumer storefront (gold/burgundy, rounded cards, prices, retail copy) becomes a clinical wholesale catalogue (mint teal, sharp flat cards, weight/karat-first, no prices in lists, weight-total bottom bar).

## Scope

Frontend + presentation only. No schema changes, no checkout logic changes, no admin changes. Cart, wishlist, auth, routing, products, and the admin panel keep working exactly as they do today — only their skins change.

## 1. Design tokens (`src/styles.css`)

- Replace palette: `--primary` = mint teal `#5BBFAD`, surfaces white/`#F8F8F8`, borders `#E5E5E5`, text `#1A1A1A` / `#555` / `#999`, warning `#FFF8E1`/`#F5C518`, gold accent `#D4A843` (hero only).
- Radius: cards `4px`, buttons `2px`. Remove heavy shadows (flat).
- Typography: keep Playfair Display for hero only; body becomes Inter (Calibri stand-in — Calibri isn't web-licensable). Add a `.font-display` utility for hero italics.
- Dark mode: keep tokens but de-emphasize — this aesthetic is light-first. Toggle stays functional.
- Add `--section-accent` underline utility and `.tracking-section` (0.12em uppercase 13px teal) helper class.

## 2. Shell — `MobileShell.tsx`

- Top bar: 52px white, 1px bottom border. Left hamburger (opens a new Sheet side menu), center `SPARKLING JEWELLERS LLP` uppercase tracked, right account + search icons. Logo image removed from bar.
- Side menu (Sheet): Home, Catalogue, My Orders, Wishlist, Account, Gold Rate, Contact, About; admin link if admin; version footer.
- Bottom bar: 3 slots — HOME, CART, and a right-aligned **TOTAL** weight readout (sum of `cart_items.quantity * products.net_weight`) in grams to 3 decimals. New `useCartWeight()` hook backed by the existing cart query.
- Theme toggle stays in the top bar (small).

## 3. Home — `routes/index.tsx`

- Hero: full-bleed 55vh slider, dark left-gradient overlay, Playfair italic collection name + spaced `C O L L E C T I O N` label, dash-pill indicators, 4s autoplay crossfade. Reuse existing hero assets.
- Limited-access banner: shown when the signed-in user has no admin role and (heuristic) no orders — dismissible per session via `localStorage`. Triangle icon, `ASK FOR ACCESS` teal button → WhatsApp deep link.
- `NEW ARRIVAL` section: teal uppercase header + underline accent, "Total Products: N" count, `VIEW ALL` outlined pill → `/catalogue?sort=newest`. Horizontal scroll row of new `CatalogueCard` (spec-only variant, no price, no CTA), with CSS ruler ticks on left + bottom edges of the image.
- `OUR COLLECTION`: 3-col, 2px gap, full-bleed photo tiles per category with `+N New` teal badge and bottom-left white overlay (name + `Designs: N Pcs`). Square-ish, no radius.

## 4. Catalogue / Category — `routes/catalogue.tsx`, `routes/category.$slug.tsx`

- Title bar shows `Category (N)`.
- SORT / FILTER / VIEW STYLE tri-tab bar (full-width, dividers). SORT and FILTER open existing sheets; VIEW STYLE toggles 2-col ↔ 1-col list.
- 2-col grid of new B2B `CatalogueCard`:
  - Wishlist `♡` top-right.
  - Square white image with ruler ticks.
  - Centered product code (SKU), Gross/Net/Karat lines.
  - Inline quantity stepper (`− [n] +`).
  - Flush-bottom teal `ADD TO CART` bar (calls existing cart upsert with chosen qty).
  - No price.
- Sticky bottom CTA strip above bottom-bar: "Want to view our entire product range? — ASK FOR ACCESS".
- Floating `⊙ ADVANCE FILTER` pill bottom-right opens the existing filter sheet.

## 5. Product detail — `routes/product.$slug.tsx`

- Image panel with "Tap to Zoom" hint (lightbox via existing Dialog).
- Config panel: SKU title, size pills, karat pills (9/14/18/20/22 — filtered to product's available metal), PIC quantity stepper, remarks textarea (stored on cart row's existing `notes`-style field if available, else local state passed at add-to-cart time — verify via `code--view`).
- Specs grid: Category / Code / Gross / Net / Pieces / Karat with zebra rows.
- Two stacked full-width CTAs: outlined `ADD TO SHORTLIST` (wishlist) + filled teal `ADD TO CART`. Existing pricing-breakdown block hidden in this redesign (kept in code, gated behind a `showPricing` flag = false by default for B2B feel).

## 6. Search — `routes/search.tsx`

- Convert to a modal-style layout: dark overlay backdrop, centered card, left filter-type rail (Code/Name/Category), right input, full-width teal `SEARCH` button. Existing query logic untouched.

## 7. Cleanup

- Remove burgundy usage from `ProductCard`, hero, CTAs, badges. Replace `bg-burgundy` / `text-burgundy` / `bg-gold` references with semantic `primary`/`accent`/`muted` classes.
- Remove `Bestseller` / `New` pill colors from old palette; new style uses teal `+N New` badge on category tiles only.
- Hide price in list contexts; keep price on product detail (gated) and cart/checkout where it's required for orders.
- WhatsApp FAB recolored to mint teal.

## 8. Out of scope (won't change)

- Database, RLS, server functions, checkout flow, admin panel, push, SEO metadata, security findings.
- Calibri font (not web-licensable) — Inter is the documented substitute.
- Dark theme is preserved but the redesign is tuned for light.

## Technical notes

- Ruler ticks: pure CSS via `repeating-linear-gradient` on a wrapper around the image; numbers via a small absolutely-positioned `<ol>` with `aria-hidden`.
- Cart weight total: derive from existing `["cart"]` query; add `useMemo` selector in `MobileShell`. No new queries.
- `localStorage` keys: `sj.dismissed.accessBanner`, `sj.viewStyle`.
- Files I'll edit (no new routes): `src/styles.css`, `src/components/MobileShell.tsx`, `src/components/ProductCard.tsx` (kept for back-compat) + new `src/components/CatalogueCard.tsx`, `src/components/HeroSlider.tsx`, `src/components/AccessBanner.tsx`, `src/components/CategoryTile.tsx`, `src/components/WhatsAppFab.tsx`, `src/routes/index.tsx`, `src/routes/catalogue.tsx`, `src/routes/category.$slug.tsx`, `src/routes/product.$slug.tsx`, `src/routes/search.tsx`.

## Delivery

One batch. Tokens + shell first, then home, then listing/detail/search, then cleanup pass. I'll verify with a build and a Playwright screenshot of `/` and `/catalogue` before handing back.
