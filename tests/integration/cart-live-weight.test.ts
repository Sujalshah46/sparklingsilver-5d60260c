import { describe, it, expect } from "vitest";
import { calculateTotalGrossWeight, calculateTotalPieces } from "../../src/lib/cart.helpers";
import type { CartItem } from "../../src/lib/cart.helpers";

function makeItem(overrides: Partial<CartItem> & { quantity: number; gross_weight?: number }): CartItem {
  const gross_weight = overrides.gross_weight ?? 0;
  return {
    id: "item-1",
    quantity: overrides.quantity,
    size: null,
    remark: null,
    product: {
      id: "prod-1",
      slug: "test-sku",
      name: "Test SKU",
      sku: "TS-001",
      purity: "925",
      gross_weight,
      image_url: null,
      image_variants: null,
    },
    ...overrides,
  } as CartItem;
}

describe("cart live weight helpers", () => {
  it("calculates gross weight from quantity and per-piece weight", () => {
    const items = [makeItem({ quantity: 3, gross_weight: 7.5 })];
    expect(calculateTotalGrossWeight(items)).toBe(22.5);
  });

  it("sums weights across multiple cart items", () => {
    const items = [
      makeItem({ id: "a", quantity: 2, gross_weight: 10 }),
      makeItem({ id: "b", quantity: 1, gross_weight: 5.5 }),
    ];
    expect(calculateTotalGrossWeight(items)).toBe(25.5);
    expect(calculateTotalPieces(items)).toBe(3);
  });

  it("handles deleted products (null product) gracefully", () => {
    const items = [
      makeItem({ quantity: 2, gross_weight: 10 }),
      { id: "missing", quantity: 1, size: null, remark: null, product: null } as CartItem,
    ];
    expect(calculateTotalGrossWeight(items)).toBe(20);
    expect(calculateTotalPieces(items)).toBe(3);
  });

  it("handles string gross_weight values from the database", () => {
    const items = [
      makeItem({ quantity: 2, gross_weight: "12.345" }),
    ];
    expect(calculateTotalGrossWeight(items)).toBeCloseTo(24.69);
  });

  it("reflects rapid quantity changes instantly without a server round-trip", () => {
    // Simulate a cart with one 7 g piece. The user taps + five times rapidly.
    const items = [makeItem({ quantity: 1, gross_weight: 7 })];
    const rapidUpdates = [2, 3, 4, 5, 6, 7];
    const results = rapidUpdates.map((qty) => {
      const updated = items.map((it) => ({ ...it, quantity: qty }));
      return {
        quantity: qty,
        weight: calculateTotalGrossWeight(updated),
      };
    });

    expect(results).toEqual([
      { quantity: 2, weight: 14 },
      { quantity: 3, weight: 21 },
      { quantity: 4, weight: 28 },
      { quantity: 5, weight: 35 },
      { quantity: 6, weight: 42 },
      { quantity: 7, weight: 49 },
    ]);
  });
});
