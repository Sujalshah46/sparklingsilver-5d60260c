import { test, expect } from "@playwright/test";

/**
 * End-to-end guard for admin → buyer live status propagation.
 *
 * Flow:
 *   1. Seed an order (owned by the signed-in session user) with 2 items in
 *      "pending".
 *   2. Open the buyer order list and the buyer order detail page.
 *   3. Perform the *same write the admin panel performs* (order_items.status
 *      update via the Data API, allowed only for admins by RLS).
 *   4. Assert the buyer list rollup badge and the per-item badge on the detail
 *      page update WITHOUT a reload, within a few seconds (polling interval is
 *      5s, so we allow a 12s ceiling for slow CI).
 *
 * Requires an authenticated Supabase session injected via the sandbox env
 * (LOVABLE_BROWSER_SUPABASE_*) belonging to an ADMIN user (so the test can
 * write item statuses). Skips itself otherwise.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://gihusjkvwzxcrilrbmww.supabase.co";
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_w-zu7Y7vidH12zFVXa4Ekw_6xnmf1nI";
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const ACCESS_TOKEN = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;

const hasAuth = Boolean(STORAGE_KEY && SESSION_JSON && ACCESS_TOKEN);

/**
 * The browser drives the BUYER session (injected preview session). The admin
 * write is performed with a separate admin token: either supplied directly
 * (E2E_ADMIN_ACCESS_TOKEN) or minted from admin credentials
 * (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). Without one, the admin half is
 * skipped rather than failing.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
let adminToken = process.env.E2E_ADMIN_ACCESS_TOKEN ?? "";

async function signInAdmin(): Promise<string> {
  if (adminToken) return adminToken;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`admin sign-in failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  adminToken = json.access_token;
  return adminToken;
}

/** How long a buyer may wait before an admin change shows up. */
const PROPAGATION_BUDGET_MS = 12_000;

type RestOptions = { method?: string; body?: unknown; prefer?: string; token?: string };
async function rest(path: string, opts: RestOptions = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method ?? "GET",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${opts.token ?? ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

test.describe("admin SKU status update → buyer order views refresh", () => {
  test.skip(!hasAuth, "Requires LOVABLE_BROWSER_SUPABASE_* session env");
  // Both pages poll every 5s; give the whole flow room.
  test.setTimeout(120_000);

  let userId: string;
  let isAdmin = false;
  let orderId = "";
  let orderNo = "";
  let itemIds: string[] = [];

  test.beforeAll(async () => {
    const session = JSON.parse(SESSION_JSON!);
    userId = session.user.id as string;

    await signInAdmin();
    isAdmin = Boolean(adminToken);
    if (!isAdmin) return;

    const products = (await rest(
      "products?select=id,name,sku,image_url,price&limit=2",
    )) as Array<{ id: string; name: string; sku: string; image_url: string | null; price: number }>;
    if (products.length < 2) throw new Error("Need 2 products to seed a split order");

    orderNo = `SS-E2E-${Date.now()}`;
    const [order] = (await rest("orders", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          order_no: orderNo,
          user_id: userId,
          status: "pending",
          subtotal: 100,
          making_charges: 0,
          gst: 0,
          total: 100,
          shipping_address: {
            recipient_name: "E2E Buyer",
            mobile: "9999999999",
            line1: "1 Test Lane",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
          },
        },
      ],
    })) as Array<{ id: string }>;
    orderId = order.id;

    const items = (await rest("order_items", {
      method: "POST",
      prefer: "return=representation",
      body: products.map((p) => ({
        order_id: orderId,
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        image_url: p.image_url,
        quantity: 1,
        unit_price: 50,
        status: "pending",
      })),
    })) as Array<{ id: string }>;
    itemIds = items.map((i) => i.id);
  });

  test.afterAll(async () => {
    if (!hasAuth || !orderId) return;
    await rest(`item_status_history?order_item_id=in.(${itemIds.join(",")})`, {
      method: "DELETE",
    }).catch(() => {});
    await rest(`order_items?order_id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
    await rest(`orders?id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
  });

  test("buyer list rollup + detail item badges update live", async ({ page }) => {
    test.skip(!isAdmin, "No admin credentials (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD) available");

    // Restore the Supabase session so the app treats us as signed in.
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY!, SESSION_JSON!] as const,
    );

    // ---------- Buyer order LIST ----------
    await page.goto("/orders", { waitUntil: "domcontentloaded" });
    const listBadge = page.getByTestId(`order-rollup-${orderNo}`);
    await expect(listBadge).toBeVisible({ timeout: 20_000 });
    await expect(listBadge).toHaveText(/received/i);

    // Admin accepts BOTH items (the write the admin panel makes).
    await rest(`order_items?id=in.(${itemIds.join(",")})`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "accepted", status_updated_at: new Date().toISOString() },
    });

    // No reload — the list must catch up on its own polling interval.
    await expect(listBadge).toHaveText(/reviewed/i, { timeout: PROPAGATION_BUDGET_MS });

    // Admin moves only ONE item forward → rollup must show partial progress.
    await rest(`order_items?id=eq.${itemIds[0]}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "confirmed", status_updated_at: new Date().toISOString() },
    });
    await rest(`order_items?id=eq.${itemIds[0]}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "processing", status_updated_at: new Date().toISOString() },
    });
    await expect(listBadge).toHaveText(/processing/i, { timeout: PROPAGATION_BUDGET_MS });

    // ---------- Buyer order DETAIL ----------
    await page.goto(`/orders/${orderId}`, { waitUntil: "domcontentloaded" });
    const item0 = page.getByTestId(`item-status-${itemIds[0]}`);
    const item1 = page.getByTestId(`item-status-${itemIds[1]}`);
    await expect(item0).toBeVisible({ timeout: 20_000 });
    await expect(item0).toHaveText(/processing/i);
    await expect(item1).toHaveText(/reviewed|received/i);

    // Admin advances the second item while the buyer sits on the page.
    await rest(`order_items?id=eq.${itemIds[1]}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "confirmed", status_updated_at: new Date().toISOString() },
    });
    await expect(item1).toHaveText(/confirmed/i, { timeout: PROPAGATION_BUDGET_MS });

    // Rollup on the detail header reacts too.
    await rest(`order_items?id=eq.${itemIds[1]}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "processing", status_updated_at: new Date().toISOString() },
    });
    await expect(page.getByTestId("order-rollup")).toHaveText(/processing/i, {
      timeout: PROPAGATION_BUDGET_MS,
    });
  });
});
