# App Store Connect — App Privacy answers (Sparkling Silver)

Copy these answers into **App Store Connect → your app → App Privacy**.
Same answers apply to the Google Play Data Safety form.

Global answer: **"Do you or your third-party partners use data for tracking?" → No.**
There is no advertising SDK, no analytics SDK and no cross-app/cross-site
tracking in the app.

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Name (contact person / business name) | Yes | Yes | No | App Functionality |
| Email address | Yes | Yes | No | App Functionality |
| Phone number | Yes | Yes | No | App Functionality |
| Physical address (shipping address) | Yes | Yes | No | App Functionality |
| Purchases / order history | Yes | Yes | No | App Functionality |
| Device ID (Expo/APNs push token) | Yes | Yes | No | App Functionality |
| Product interaction / usage data (cart, wishlist, order activity log) | Yes | Yes | No | App Functionality |
| User content (per-item order remarks) | Yes | Yes | No | App Functionality |
| Precise/coarse location | No | — | — | permission is blocked in the build |
| Photos / camera content | No | — | — | camera is not used at all; the photo library is only opened by the user to pick a spreadsheet/image for catalogue import, and nothing is read in the background |
| Health, financial, browsing history, contacts, search history, sensitive info | No | — | — | not collected |
| Crash / performance data | No | — | — | no crash SDK bundled |

Notes for the reviewer form:

- **Account creation is not self-service.** Accounts are created by Sparkling
  Silver staff for verified wholesale buyers; there is no public sign-up.
- **Account deletion is available in-app**: Account → "Delete my account"
  (Guideline 5.1.1(v)). It deletes the profile, cart, wishlist and push tokens
  and blocks further sign-in; only legally required order records are retained.
- **Privacy Policy URL**: https://sparklingsilver.in/privacy
- **Support URL**: https://sparklingsilver.in/contact
- **Camera is NOT declared.** The app bundles no camera module, so
  `NSCameraUsageDescription` and the Android CAMERA permission were removed.
- **Photo library** is declared (`NSPhotoLibraryUsageDescription`) only so the
  in-app file picker used for catalogue import does not terminate; location,
  microphone and camera permissions are explicitly blocked, so do **not**
  declare them.
- The bundled `PrivacyInfo.xcprivacy` manifest declares the data types in the
  table above (name, email, phone, address, purchases, device ID, product
  interaction, user content) with tracking = No; mirror that in App Store
  Connect → App Privacy.
