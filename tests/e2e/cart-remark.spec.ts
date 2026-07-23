import { test, expect } from "@playwright/test";

/**
 * Verifies a remark typed on a cart item:
 *   1. persists to the database (survives a cart reload — proves the blur-save
 *      round-tripped and the background refetch didn't clobber the input), and
 *   2. carries into the order-review step (the /checkout page loads with the
 *      seeded cart intact) and into order_items.remark after placeOrder.
 *
 * Requires an authenticated Supabase session injected via the sandbox env
 * (LOVABLE_BROWSER_SUPABASE_*). If those aren't present (local CI without a
 * signed-in preview), the test skips itself rather than failing.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://gihusjkvwzxcrilrbmww.supabase.co";
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_w-zu7Y7vidH12zFVXa4Ekw_6xnmf1nI";
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const ACCESS_TOKEN = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;

const hasAuth = Boolean(STORAGE_KEY && SESSION_JSON && ACCESS_TOKEN);

type RestOptions = { method?: string; body?: unknown; prefer?: string };
async function rest(path: string, opts: RestOptions = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method ?? "GET",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

test.describe("cart remark → order review", () => {
  test.skip(!hasAuth, "Requires LOVABLE_BROWSER_SUPABASE_* session env");

  const remarkText = `E2E remark ${Date.now()} — please engrave "A"`;
  let userId: string;
  let productId: string;
  let cartItemId: string | null = null;

  test.beforeAll(async () => {
    const session = JSON.parse(SESSION_JSON!);
    userId = session.user.id as string;

    // Pick any in-stock product to seed a cart row against.
    const products = (await rest(
      "products?select=id&in_stock=eq.true&limit=1",
    )) as Array<{ id: string }>;
    if (!products.length) throw new Error("No in-stock product available for e2e seed");
    productId = products[0].id;

    // Clear any pre-existing cart so the test is deterministic.
    await rest(`cart_items?user_id=eq.${userId}`, { method: "DELETE" });

    const inserted = (await rest("cart_items", {
      method: "POST",
      prefer: "return=representation",
      body: [{ user_id: userId, product_id: productId, quantity: 1 }],
    })) as Array<{ id: string }>;
    cartItemId = inserted[0].id;
  });

  test.afterAll(async () => {
    if (!hasAuth) return;
    // Best-effort cleanup: remove leftover cart row if the test bailed early.
    await rest(`cart_items?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  });

  test("typed remark persists and carries into order_items.remark", async ({ page, context }) => {
    // Restore Supabase session so the app treats us as signed in.
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY!, SESSION_JSON!] as const,
    );

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    // Wait for the seeded cart row to render.
    const textarea = page.getByPlaceholder(/add a note for this product/i).first();
    await textarea.waitFor({ state: "visible", timeout: 15_000 });

    await textarea.click();
    await textarea.fill(remarkText);
    await textarea.blur();

    // The blur handler kicks off updateRemark → cart refetch. Poll the DB via
    // REST until we see the write land, so we're testing the real save path.
    await expect
      .poll(
        async () => {
          const rows = (await rest(
            `cart_items?id=eq.${cartItemId}&select=remark`,
          )) as Array<{ remark: string | null }>;
          return rows[0]?.remark ?? null;
        },
        { timeout: 10_000, message: "remark never saved to cart_items" },
      )
      .toBe(remarkText);

    // Reload /cart and assert the textarea rehydrates with the saved value —
    // this is the regression guard: the refetch must not clobber, and the
    // fresh mount must render the persisted string.
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = page.getByPlaceholder(/add a note for this product/i).first();
    await expect(reloaded).toHaveValue(remarkText, { timeout: 10_000 });

    // Move to the order-review step (/checkout). The seeded item must still
    // be there — this is the surface where the customer confirms before
    // placing, so the remark it carries needs to survive the transition.
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
      timeout: 15_000,
    });

    // Fill the minimal shipping fields and place the order so we can prove
    // the remark propagated into order_items.remark server-side.
    await page.getByLabel(/full name/i).fill("E2E Test User");
    await page.getByLabel(/whatsapp \/ phone/i).fill("9999999999");
    await page.getByLabel(/^email/i).fill("e2e@example.com");
    await page.getByLabel(/delivery address/i).fill("1 Test Lane");
    await page.getByLabel(/^city/i).fill("Mumbai");
    await page.getByLabel(/pincode/i).fill("400001");
    await page.getByRole("button", { name: /place order/i }).click();

    // Success screen shows "Order Placed!" — wait for it, then scrape the
    // order number so we can verify the remark on the server row.
    await expect(page.getByText(/order placed!/i)).toBeVisible({ timeout: 30_000 });
    const orderNo = await page
      .locator("p")
      .filter({ hasText: /^SS/i })
      .first()
      .innerText()
      .catch(() => "");

    const orders = (await rest(
      `orders?user_id=eq.${userId}&order_no=eq.${encodeURIComponent(orderNo)}&select=id`,
    )) as Array<{ id: string }>;
    expect(orders.length, `order ${orderNo} not found`).toBeGreaterThan(0);
    const orderId = orders[0].id;

    const orderItems = (await rest(
      `order_items?order_id=eq.${orderId}&select=remark,product_id`,
    )) as Array<{ remark: string | null; product_id: string }>;
    const seeded = orderItems.find((r) => r.product_id === productId);
    expect(seeded, "seeded product row missing from order_items").toBeTruthy();
    expect(seeded!.remark).toBe(remarkText);

    // Cleanup: delete the test order + its items so we don't pollute history.
    await rest(`order_items?order_id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
    await rest(`orders?id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});

    // The cart row was cleared by placeOrder, so nothing else to tear down.
    cartItemId = null;
    // Silence unused-var lint for context in editors that flag it.
    void context;
  });
});
