# Sparkling Silver — Expo Wrapper

Wraps the live web app (https://sparklingsilver.in) inside a native shell so you can open it in **Expo Go** and share an Expo link.

## Run locally (gives you the Expo Go QR / link)

```bash
cd expo-wrapper
npm install
npx expo start
```

- Install **Expo Go** on your phone (iOS App Store / Google Play).
- Scan the QR shown in the terminal — the app opens on your device.
- The terminal also prints an `exp://...` link you can share with anyone on the same network.

## Share with anyone over the internet (public Expo link)

Use a tunnel (no same-WiFi requirement):

```bash
npx expo start --tunnel
```

This prints a public `exp://u.expo.dev/...` URL that opens in Expo Go from anywhere.

## Add app icon & splash

Drop two PNGs into `assets/`:

- `assets/icon.png` — 1024×1024
- `assets/splash.png` — 1242×2436 (centered logo, white bg)

## Build a standalone APK / IPA (optional)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Notes

- Pull-to-refresh and Android hardware back are wired up.
- Cookies and localStorage persist, so login on the web app carries over.
- If you change `SITE_URL` in `App.js`, restart the dev server.

## Native push notifications (satisfies iOS Guideline 4.2)

The wrapper now registers for real OS notifications through `expo-notifications`
(APNs on iOS, FCM on Android) — web push inside a WebView never fires on iOS.

Flow:
1. On launch the app asks for the notification permission and fetches an Expo push token.
2. The token is injected into the WebView; `NativePushBridge` in the web app saves it
   against the signed-in user (`expo_push_tokens` table).
3. Server-side order events call `notifyAdmins` / `notifyUser`, which fan out to
   Expo's push service (and web push for desktop browsers).
4. Tapping a notification deep-links into the right page inside the WebView, and the
   app badge is cleared on open.

Before submitting:
- `cd expo-wrapper && npm install`
- iOS: create an APNs key in the Apple Developer portal and upload it with
  `eas credentials` (Expo needs it to deliver to production builds).
- Android: EAS provisions FCM automatically for managed credentials.
- Build with `eas build -p ios` / `eas build -p android` (a dev-client or store build —
  push tokens are not issued in Expo Go on iOS).
- Optional: set an `EXPO_ACCESS_TOKEN` secret in the backend to use an authenticated
  Expo push channel with higher rate limits.

## iOS App Store submission checklist

Verified in code:

- **Guideline 4.2 (minimum functionality)** — native push notifications
  (`expo-notifications`), Expo push token registration, Android notification
  channel, notification-tap deep linking, badge clearing, native back-gesture /
  hardware-back handling, pull-to-refresh, and screen-capture protection.
- **Guideline 2.1 (completeness)** — offline / server-error screen with a
  "Try again" button instead of a blank WebView, plus a launch spinner.
- **External links** — `wa.me`, `tel:`, `mailto:` and Instagram open in the
  system app via `Linking` (`onShouldStartLoadWithRequest` + `onOpenWindow`);
  first-party hosts stay in the WebView.
- **Guideline 5.1.1(v) (account deletion)** — Account → "Delete my account"
  deletes the buyer account in-app (no email/phone step required).
- **Guideline 5.1.1 / 5.1.2 (privacy)** — `/privacy` and `/terms` are
  reachable without signing in and linked from the sign-in footer and the
  Account screen.
- **Encryption** — `ITSAppUsesNonExemptEncryption: false` is set, so no export
  compliance questionnaire on each upload.
- **Permissions** — only camera (with a usage string) and notifications;
  location / mic / photo-library permissions are explicitly blocked.
- Icon is 1024×1024 with no alpha channel; splash is 1284×2778.

Done for you (no action needed):

1. **Demo reviewer account** — a dedicated buyer account is live, with a fixed
   password, profile already completed and a default delivery address, so the
   reviewer lands straight on the catalogue (no onboarding, no forced password
   change). Paste these into **App Review Information → Sign-In Required**:

   ```
   Email:    appstore.review@sparklingsilver.in
   Password: AppleReview@2026
   ```

   Notes field suggestion: "Wholesale B2B catalogue. Accounts are created by the
   admin; there is no public sign-up. No in-app payment — orders are quotes
   fulfilled offline. Push notifications deliver order-status updates."
   Do not delete or deactivate this account in Admin → Users.
2. **App Privacy questionnaire** — exact answers are in
   `expo-wrapper/APP-STORE-PRIVACY.md`; copy them field by field.
3. **iPad** — `supportsTablet: false`, so **no iPad screenshots are required**.
   Only 6.9" and 6.5" iPhone screenshots are needed.

Still to do in App Store Connect (cannot be done from code):

1. **Screenshots** for 6.9" and 6.5" iPhone.
2. **Support URL** → `https://sparklingsilver.in/contact`,
   **Privacy Policy URL** → `https://sparklingsilver.in/privacy`.
3. **Age rating**, category (Shopping), and copyright.
4. **APNs key** uploaded via `eas credentials` before the production build,
   then `eas build -p ios --profile production && eas submit -p ios`.

Note: the app is a wholesale B2B catalogue with no in-app payment, so no
In-App Purchase is required (Guideline 3.1.1 does not apply — orders are
quotes fulfilled offline). Keep it that way, or IAP rules kick in.
