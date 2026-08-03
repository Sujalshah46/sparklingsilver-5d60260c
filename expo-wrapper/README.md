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
