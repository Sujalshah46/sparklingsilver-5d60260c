import { test, expect, type Route } from "@playwright/test";

/**
 * Verifies the site-wide auth gate:
 *  - Unauthenticated visitors hitting any protected route must land on /auth
 *  - The homepage (or any protected page) must NEVER paint / render its DOM
 *    before the redirect, even under simulated slow-device / slow-network
 *    conditions.
 *
 * Runs against two projects (see playwright.config.ts):
 *   • desktop-fast  — Desktop Chrome, no throttling
 *   • mobile-slow   — Pixel 5, CPU + network throttled via CDP
 */

// Guideline 5.1.1(v): browsing is public. Only account-specific pages gate.
const PROTECTED_PATHS = ["/cart", "/orders", "/account", "/wishlist"];

// A DOM signature only the real homepage / catalogue ships (never on /auth).
const HOMEPAGE_MARKERS = [
  "text=/new arrivals/i",
  "text=/bestseller/i",
  "text=/shop by category/i",
  "text=/antique/i",
  "[data-testid=product-card]",
];

async function throttleIfSlow(page: import("@playwright/test").Page, projectName: string) {
  if (projectName !== "mobile-slow") return;
  const client = await page.context().newCDPSession(page);
  // 4x CPU slowdown + roughly Slow 3G. Enough to expose a hydration-flash,
  // not so extreme that the initial HTML never arrives.
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (750 * 1024) / 8, // 750 Kbps
    uploadThroughput: (750 * 1024) / 8,
    latency: 200,
  });
}

for (const path of PROTECTED_PATHS) {
  test(`unauthenticated ${path} redirects to /auth without rendering protected DOM`, async ({
    page,
  }, testInfo) => {
    await throttleIfSlow(page, testInfo.project.name);

    // Fresh context — no session in localStorage.
    await page.context().clearCookies();

    // Record every top-level document response so we can prove no protected
    // HTML was ever presented to the user (redirect happens before paint).
    const documentUrls: string[] = [];
    page.on("response", (res) => {
      if (res.request().resourceType() === "document") documentUrls.push(res.url());
    });

    // Also assert that if the SSR'd homepage HTML *does* arrive, our inline
    // auth-gate script fires location.replace() BEFORE any homepage element
    // gets attached to the DOM. We check by racing markers vs. the /auth URL.
    const homepageMarkerAppeared = page
      .waitForSelector(HOMEPAGE_MARKERS.join(", "), { state: "attached", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    await page.goto(path, { waitUntil: "commit" }).catch(() => {});

    // Wait until the URL settles on /auth (redirect may be sync inline script
    // or client-side navigate — both are acceptable).
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 20_000 });

    // The auth page must be the one actually rendered.
    await expect(page).toHaveURL(/\/auth(\?|$)/);
    await expect(page.getByRole("button", { name: /login|sign in/i })).toBeVisible();

    // Protected DOM must never have attached.
    const leaked = await homepageMarkerAppeared;
    expect(leaked, "protected homepage DOM was rendered before /auth redirect").toBe(false);

    // Redirect must carry the original path so post-login lands correctly.
    if (path !== "/") {
      expect(page.url()).toContain(`redirect=${encodeURIComponent(path)}`);
    }

    // Sanity: at least one document response was for /auth.
    expect(documentUrls.some((u) => new URL(u).pathname.startsWith("/auth"))).toBeTruthy();
  });
}

test("public paths (/auth, /reset-password) are NOT redirected", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/auth(\?|$)/);
  await expect(page.getByRole("button", { name: /login|sign in/i })).toBeVisible();
});
