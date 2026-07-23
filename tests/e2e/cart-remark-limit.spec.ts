import { test, expect } from "@playwright/test";

/**
 * Verifies the 500-character cap on cart item remarks end-to-end:
 *   1. Typing/pasting past 500 characters is truncated by the textarea's
 *      onChange slice + maxLength attribute.
 *   2. The blur-save round-trips exactly 500 characters to cart_items.remark.
 *   3. After placing the order, order_items.remark is exactly the truncated
 *      500-character string — not the original oversized input.
 *
 * Requires an authenticated Supabase session injected via the sandbox env
 * (LOVABLE_BROWSER_SUPABASE_*). Skips locally when those aren't present.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://gihusjkvwzxcrilrbmww.supabase.co";
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_w-zu7Y7vidH12zFVXa4Ekw_6xnmf1nI";
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const ACCESS_TOKEN = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;

const hasAuth = Boolean(STORAGE_KEY && SESSION_JSON && ACCESS_TOKEN);

const REMARK_MAX_LENGTH = 500;

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

test.describe("cart remark → 500-char cap", () => {
  test.skip(!hasAuth, "Requires LOVABLE_BROWSER_SUPABASE_* session env");

  // Marker prefix keeps the assertion readable while still exercising the
  // full 500-char path — we set the first 20 chars, then pad with 'x' up to
  // 600 so the typed input is objectively oversized.
  const marker = `E2E-CAP-${Date.now().toString().slice(-6)}::`;
  const oversized = marker + "x".repeat(600 - marker.length);
  const expectedTruncated = oversized.slice(0, REMARK_MAX_LENGTH);

  let userId: string;
  let productId: string;
  let cartItemId: string | null = null;

  test.beforeAll(async () => {
    const session = JSON.parse(SESSION_JSON!);
    userId = session.user.id as string;

    const products = (await rest(
      "products?select=id&in_stock=eq.true&limit=1",
    )) as Array<{ id: string }>;
    if (!products.length) throw new Error("No in-stock product available for e2e seed");
    productId = products[0].id;

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
    await rest(`cart_items?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  });

  test("oversized remark is truncated to 500 chars in cart and order_items", async ({ page }) => {
    // Sanity: the string we're about to paste is genuinely too long, otherwise
    // this test degenerates into the same assertion as the happy-path spec.
    expect(oversized.length).toBeGreaterThan(REMARK_MAX_LENGTH);

    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY!, SESSION_JSON!] as const,
    );

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    const textarea = page.getByPlaceholder(/add a note for this product/i).first();
    await textarea.waitFor({ state: "visible", timeout: 15_000 });

    // maxLength on the DOM node is the primary UI guardrail — assert it so a
    // regression that widens the cap fails here rather than downstream.
    await expect(textarea).toHaveAttribute("maxlength", String(REMARK_MAX_LENGTH));

    await textarea.click();
    // Use fill() to inject the entire oversized string in one shot; the
    // component's onChange slice + native maxLength should cap it at 500.
    await textarea.fill(oversized);

    const typedValue = await textarea.inputValue();
    expect(typedValue).toHaveLength(REMARK_MAX_LENGTH);
    expect(typedValue).toBe(expectedTruncated);

    // Counter must show the cap, not the oversized input length.
    await expect(page.getByText(`${REMARK_MAX_LENGTH}/${REMARK_MAX_LENGTH}`)).toBeVisible();

    await textarea.blur();

    // The blur save must round-trip the truncated string — not the raw input
    // and not something clipped by the DB CHECK constraint (which would 4xx).
    await expect
      .poll(
        async () => {
          const rows = (await rest(
            `cart_items?id=eq.${cartItemId}&select=remark`,
          )) as Array<{ remark: string | null }>;
          return rows[0]?.remark ?? null;
        },
        { timeout: 10_000, message: "truncated remark never saved to cart_items" },
      )
      .toBe(expectedTruncated);

    // Move to order review and place the order so we can confirm the
    // truncated string propagates into the permanent order_items row.
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel(/full name/i).fill("E2E Test User");
    await page.getByLabel(/whatsapp \/ phone/i).fill("9999999999");
    await page.getByLabel(/^email/i).fill("e2e@example.com");
    await page.getByLabel(/delivery address/i).fill("1 Test Lane");
    await page.getByLabel(/^city/i).fill("Mumbai");
    await page.getByLabel(/pincode/i).fill("400001");
    await page.getByRole("button", { name: /place order/i }).click();

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
    expect(seeded!.remark).toHaveLength(REMARK_MAX_LENGTH);
    expect(seeded!.remark).toBe(expectedTruncated);

    await rest(`order_items?order_id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
    await rest(`orders?id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});

    cartItemId = null;
  });
});
