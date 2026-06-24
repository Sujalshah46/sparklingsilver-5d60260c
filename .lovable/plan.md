
# Sparkling Jewellers LLP — Build Plan

A mobile-first **responsive web app (PWA)** that looks and feels like a premium Indian jewellery native app. Built on TanStack Start + Tailwind + Lovable Cloud, with Stripe payments. Given the size of the spec, I'll deliver in **three phases**; this plan covers **Phase 1** (the full storefront — everything you can actually shop with). Phases 2 and 3 are scoped at the bottom.

---

## Design direction

- **Palette:** Gold `#C9A84C`, Burgundy `#6D1F2E`, Ivory `#FAF7F2`, Charcoal `#1C1C1C`, Rose Gold `#B76E79`
- **Type:** Playfair Display (headings) + Inter (body), via `@fontsource`
- **Feel:** Warm ivory canvas, gold hairlines, serif headings with generous letter-spacing, soft burgundy CTAs, gold shimmer on splash/loading, currency in ₹, weights in g
- **Layout:** Bottom tab bar (Home · Catalogue · Cart · Wishlist · Account), sticky top bar with logo + search + bell + cart, large tap targets (≥44px)

---

## Phase 1 scope (this build)

### Branding (AI-generated)
- Logo wordmark "Sparkling Jewellers LLP" in gold serif on transparent PNG
- 10 product photos matching the sample list (rings, necklace sets, bangles, etc.)
- 3 hero banner images (Bridal, Festive, Daily Wear)

### Auth (Lovable Cloud)
- Email/password + Google sign-in (via Lovable's iframe-safe broker)
- Splash screen with gold shimmer
- 3-slide onboarding carousel
- Login + Register screens (name, mobile, email, city, business type, GSTIN optional)
- "Continue as Guest" — browse-only, prompts sign-in at checkout

### Storefront pages
1. **Home** — gold rate strip (24K/22K/18K/Silver, static), hero carousel, category grid (10 categories), New Arrivals, Featured Collections (Bridal/Daily/Office/Festival), Best Sellers, Trending, footer CTA
2. **Catalogue / Category listing** — 2-col grid, sort + filter modal (category, metal, purity, weight slider, price slider, stone, occasion)
3. **Search** — full-text over name/SKU/category, recent + popular searches
4. **Product Detail** — image gallery with pinch-zoom, weight breakdown, pricing breakdown (gold value + making + GST), size selector, MOQ, similar products, Add to Cart / Wishlist / WhatsApp Enquire (floating button)
5. **Cart** — line items, qty stepper, coupon field, totals
6. **Checkout** — 4 steps: confirm → address (saved + new) → payment → confirmation. Stripe Checkout for card payments.
7. **Wishlist** — grid, remove, move to cart, share
8. **My Orders** — list + detail, status pipeline (Placed→Processing→Ready→Dispatched→Delivered), reorder
9. **Profile / Account** — info, addresses CRUD, KYC fields, notification toggles, language/theme stub, help, about, logout
10. **Gold Rate page** — table + simple line chart (last 7 days, seeded data)
11. **Enquiry / Contact** — form + WhatsApp deep link + store info

### Backend (Lovable Cloud / Supabase)
Tables with RLS + grants:
- `profiles` (auto-created on signup; trigger)
- `user_roles` (separate table, `app_role` enum, `has_role` SECURITY DEFINER)
- `categories`, `collections`, `products` (public read), `product_images`
- `addresses`, `cart_items`, `wishlist_items` (owner-only)
- `orders`, `order_items` (owner-only; service role for status updates)
- `gold_rates` (public read, admin write)
- `coupons` (public read for active codes)
- `enquiries` (insert by anyone, read by admin)
- Seed migration loads 10 products + categories + collections + dummy gold rates + dummy 7-day history

### Payments
- Lovable's built-in **Stripe** (no account setup, sandbox immediately)
- Tax handling: **automatic_tax** (calculate & collect only) since this is physical jewellery
- Stripe Checkout session created via server function; webhook updates order status

### PWA
- Manifest + gold-shimmer icons + theme color = installable on iOS/Android home screen
- No offline service worker in Phase 1 (you didn't ask for offline)

---

## Phase 2 (next build, after Phase 1 approval)
- Notifications screen + push (FCM requires Firebase setup — will ask then)
- Coupons engine + Refer & Earn
- Mobile OTP login (requires Twilio — will ask then)
- Multi-language (English/Hindi/Gujarati) with i18n
- Dark mode
- Live gold rate API integration (will recommend a provider)

## Phase 3
- Admin dashboard (products, orders, customers, banners, gold rate, coupons, analytics)
- WhatsApp Business API (beyond simple wa.me link)
- Razorpay/UPI if you still want it after Stripe is live

---

## Technical notes
- TanStack Start (React 19, Vite 7, Tailwind v4)
- Routes: public for home/catalogue/product/auth; `_authenticated/` for cart-checkout/orders/profile/wishlist
- Server functions for cart/order/checkout mutations; `requireSupabaseAuth` middleware
- Stripe Checkout via server function + `/api/public/webhooks/stripe` route with signature verification
- All copy in ₹ INR; weights in grams; trust badges (BIS hallmark, 916, certified diamonds)

---

Approve to start Phase 1. I'll enable Lovable Cloud + Stripe, run migrations, generate branding assets, and build out the storefront end-to-end.
