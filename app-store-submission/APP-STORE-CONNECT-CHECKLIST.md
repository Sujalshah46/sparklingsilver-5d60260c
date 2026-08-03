# App Store Connect submission checklist — Sparkling Silver

Everything below is either already in the repo or is a field you copy into
App Store Connect. Work top to bottom; nothing else is required for review.

## 1. App record

| Field | Value |
|---|---|
| App name | Sparkling Silver |
| Subtitle | Wholesale silver jewellery orders |
| Bundle ID | com.sparklingsilver.app |
| SKU | SPARKLING-SILVER-IOS-001 |
| Primary language | English (India) |
| Primary category | Shopping |
| Secondary category | Business |
| Version | 1.0.0 (build 1) |
| Copyright | 2026 Sparkling Silver |

Listing copy (description, keywords, promo text, What's New, captions) lives in
`app-store-submission/app-store-listing.md`.

## 2. URLs

| Field | Value |
|---|---|
| Support URL | https://sparklingsilver.in/contact |
| Marketing URL | https://sparklingsilver.in |
| Privacy Policy URL | https://sparklingsilver.in/privacy |
| Terms (EULA) | https://sparklingsilver.in/terms — standard Apple EULA is fine |
| Account deletion | In-app: Account → Delete my account (Guideline 5.1.1(v)) |

## 3. Screenshots

- **6.9" iPhone (required)** — `iphone-6.9-screenshots/` (1290 × 2796, 6 files)
- **6.5" iPhone (optional fallback)** — `iphone-6.5-screenshots/` (1242 × 2688, 6 files)
- **iPad** — not required. `ios.supportsTablet` is `false`, so the app is
  submitted as iPhone-only and App Store Connect will not ask for iPad assets.
- Upload in filename order: home, catalogue, product detail, cart, orders, account.
- No app preview video is required for 1.0.

## 4. App icon

`expo-wrapper/assets/` ships all three iOS 18 appearance variants:

| Variant | File |
|---|---|
| Light | `icon.png` (1024 × 1024, opaque, no alpha) |
| Dark | `icon-dark.png` |
| Tinted | `icon-tinted.png` (grayscale, transparent background) |

They are wired through `ios.icon` in `expo-wrapper/app.json`, so EAS generates
the full asset catalogue automatically. Icons contain no transparency in the
light/dark variants and no rounded corners baked in, per Apple's HIG.

## 5. Sign-in / demo account (Guideline 2.1)

The app has **no public sign-up** — accounts are created by Sparkling Silver
staff for verified wholesale buyers. A demo account **must** be supplied or the
build is rejected.

- Check **"Sign-in required"** in App Review Information.
- Username: `appstore.review@sparklingsilver.in`
- Password: `AppleReview@2026`
- This account is permanent, pre-onboarded (no gate to clear) and has sample
  orders in multiple states so reviewers can see cart, checkout, order history,
  edit-order and cancellation flows.

## 6. App Review notes (paste as-is)

> Sparkling Silver is a B2B wholesale catalogue and ordering app for jewellery
> retailers buying from Sparkling Silver (Rajkot, India).
>
> Sign-in is required and accounts are created by our staff for verified
> business buyers, so no public registration exists. Please use the demo
> account provided in the credentials fields.
>
> No payments occur in the app: buyers place weight-based wholesale orders and
> settlement happens offline against an invoice, so no in-app purchase or
> external payment mechanism is present.
>
> Native functionality beyond web content: remote push notifications for order
> status updates (APNs via Expo), an offline/connection-error retry screen,
> native handling of external links (WhatsApp, Instagram, tel, mailto), and
> in-app account deletion under Account → Delete my account.
>
> The camera permission is used only by staff accounts for live barcode
> scanning in the catalogue tools; nothing is captured or stored. Location,
> microphone and photo-library permissions are explicitly blocked in the build.

## 7. Age rating answers

All content questions → **None**. Specifically:

| Question | Answer |
|---|---|
| Violence, sexual content, profanity, horror | None |
| Alcohol, tobacco, drugs | None |
| Simulated gambling / real gambling | No |
| Contests | No |
| Unrestricted web access | **No** — the app loads only sparklingsilver.in |
| Medical/treatment information | No |
| User-generated content shared publicly | No (order remarks are private to the buyer and staff) |
| Messaging / chat between users | No |
| Location sharing | No |
| Age assurance / kids category | Not in Kids category |

Resulting rating: **4+**.

## 8. Export compliance

- Uses encryption: **Yes** (HTTPS only).
- Qualifies for the exemption: **Yes** — standard OS-provided TLS only.
- Already declared in the build: `ITSAppUsesNonExemptEncryption = false` and
  `ios.config.usesNonExemptEncryption = false`, so App Store Connect will not
  prompt for ERN documentation.

## 9. Content rights

- Contains third-party content: **No**. All product photography, copy and
  branding are owned by Sparkling Silver.

## 10. App Privacy

Answers for the App Privacy questionnaire (and Play Data Safety) are in
`expo-wrapper/APP-STORE-PRIVACY.md`. Summary: data is collected, linked to the
user, and used only for App Functionality; **tracking = No**; no third-party
analytics or ad SDKs.

## 11. Pricing and availability

- Price: Free (business tool; no in-app purchases).
- Availability: All territories, or restrict to India if you prefer.
- Release: Manual release after approval is recommended for 1.0.

## 12. Pre-upload build checks

```bash
cd expo-wrapper
npx expo-doctor
eas build -p ios --profile production
eas submit -p ios --latest
```

Confirm before submitting:

- [ ] `version` / `buildNumber` bumped for every new upload
- [ ] Push notifications work on a physical device (APNs key uploaded to EAS)
- [ ] Offline screen appears with network disabled, and retry recovers
- [ ] Demo account signs in on the release build
- [ ] Account deletion completes and blocks re-sign-in
- [ ] `node scripts/security-scan.mjs` passes with no high/critical findings
