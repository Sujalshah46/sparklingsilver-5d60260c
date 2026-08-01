/**
 * Shared quantity rules for buyer-side order edits.
 * Used by both the UI (steppers / inline errors) and the server function so
 * the browser and the server can never disagree.
 */

export const MAX_ITEM_QTY = 999;

export type QtyLimitSource = {
  /** Minimum order quantity from the product row. */
  moq?: number | string | null;
  /** Live stock; null/undefined means stock isn't tracked for this SKU. */
  stock_quantity?: number | string | null;
  in_stock?: boolean | null;
};

export type QtyLimits = { min: number; max: number; stockCapped: boolean };

/** Resolve the allowed [min, max] quantity window for one SKU. */
export function qtyLimits(p: QtyLimitSource | null | undefined, currentQty = 1): QtyLimits {
  const moqRaw = Number(p?.moq ?? 1);
  const min = Number.isFinite(moqRaw) && moqRaw >= 1 ? Math.floor(moqRaw) : 1;

  const stockRaw = p?.stock_quantity;
  const stock = stockRaw == null ? null : Number(stockRaw);
  const hasStock = stock != null && Number.isFinite(stock) && stock >= 0;

  // Never force the buyer below what they already ordered, and never below moq.
  let max = MAX_ITEM_QTY;
  let stockCapped = false;
  if (hasStock) {
    const cap = Math.max(stock as number, Math.min(currentQty, MAX_ITEM_QTY), min);
    if (cap < MAX_ITEM_QTY) {
      max = cap;
      stockCapped = (stock as number) < MAX_ITEM_QTY;
    }
  }
  if (max < min) max = min;
  return { min, max, stockCapped };
}

/** Clamp a quantity into the allowed window. */
export function clampQty(qty: number, limits: QtyLimits): number {
  const n = Math.floor(Number.isFinite(qty) ? qty : limits.min);
  return Math.min(limits.max, Math.max(limits.min, n));
}

/** Returns a buyer-facing error message, or null when the quantity is valid. */
export function validateQty(
  qty: number,
  limits: QtyLimits,
  label: string,
): string | null {
  if (!Number.isInteger(qty)) return `${label}: quantity must be a whole number.`;
  if (qty < 1) return `${label}: quantity must be at least 1.`;
  if (qty < limits.min) return `${label}: minimum order quantity is ${limits.min} pcs.`;
  if (qty > MAX_ITEM_QTY) return `${label}: maximum ${MAX_ITEM_QTY} pcs per SKU.`;
  if (qty > limits.max)
    return `${label}: only ${limits.max} pcs available right now.`;
  return null;
}
