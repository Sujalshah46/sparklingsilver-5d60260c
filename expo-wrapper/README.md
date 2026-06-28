# Sparkling Silver LLP — Expo Wrapper

Wraps the live web app (https://sparkling-jewellers-llp.lovable.app) inside a native shell so you can open it in **Expo Go** and share an Expo link.

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
