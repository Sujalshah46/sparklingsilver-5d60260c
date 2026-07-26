import { test, expect, type Page } from "@playwright/test";

/**
 * Regression guard: the "Limited App Access" banner was removed from the app.
 * It must never reappear on the homepage, category pages, or admin routes.
 *
 * The site is auth-gated, so this test runs twice over the same routes:
 *   1. Always — the server-rendered HTML for each route must not contain the
 *      phrase (catches it being re-added to SSR markup or a shared shell).
 *   2. When a Supabase session is injected via the sandbox env
 *      (LOVABLE_BROWSER_SUPABASE_*) — the fully rendered DOM must not contain
 *      it either. Without a session those assertions are skipped.
 */

const BANNER_RE = /limited\s+app\s+access/i;

const ROUTES = [
  "/",
  "/catalogue",
  "/category/antique",
  "/category/cz",
  "/category/antique/tops",
  "/admin",
  "/admin/products",
  "/admin/orders",
  "/admin/inventory",
  "/admin/users",
];

const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const hasAuth = Boolean(STORAGE_KEY && SESSION_JSON);

async function restoreSession(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY as string, SESSION_JSON as string],
  );
}

test.describe("Limited App Access banner is gone", () => {
  for (const path of ROUTES) {
    test(`server HTML for ${path} has no banner`, async ({ request, baseURL }) => {
      const res = await request.get(new URL(path, baseURL ?? "http://localhost:8080").toString());
      const html = await res.text();
      expect(html, `"Limited App Access" found in SSR HTML for ${path}`).not.toMatch(BANNER_RE);
    });
  }

  for (const path of ROUTES) {
    test(`rendered DOM for ${path} has no banner`, async ({ page }) => {
      test.skip(!hasAuth, "No Supabase session injected — cannot reach gated routes");

      await restoreSession(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      // Let client-side data/render settle so a lazily-rendered banner would show.
      await page.waitForLoadState("networkidle").catch(() => {});

      await expect(page.getByText(BANNER_RE)).toHaveCount(0);

      const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? "";
      expect(bodyText, `"Limited App Access" visible on ${path}`).not.toMatch(BANNER_RE);
    });
  }
});
