/**
 * Shared, pure helpers for item-level (split) order fulfillment.
 * No server / browser specific imports — safe everywhere.
 */

export type ItemStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "confirmed"
  | "processing"
  | "ready"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** The linear pipeline every item walks through. */
export const PIPELINE: ItemStatus[] = [
  "pending",
  "accepted",
  "confirmed",
  "processing",
  "dispatched",
  "out_for_delivery",
  "delivered",
];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  accepted: "Reviewed",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  dispatched: "Dispatched",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Statuses that no longer participate in the rollup. */
export const TERMINAL_INACTIVE: ItemStatus[] = ["cancelled", "rejected"];

export const isActive = (s: string) => !TERMINAL_INACTIVE.includes(s as ItemStatus);

export const stageIndex = (s: string) => PIPELINE.indexOf(s as ItemStatus);

/** Splitting only becomes legal from "confirmed" onward. */
export const canSplitFrom = (s: string) => stageIndex(s) >= stageIndex("confirmed");

/** Next stage in the pipeline, or null at the end / for unknown statuses. */
export function nextStatus(s: string): ItemStatus | null {
  const i = stageIndex(s);
  if (i < 0 || i >= PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}

export function isValidTransition(from: string, to: string): boolean {
  return nextStatus(from) === to;
}

export interface Rollup {
  /** Status to display for the whole order. */
  status: ItemStatus;
  /** True when active items sit at more than one stage. */
  split: boolean;
  /** How many active items sit at `status`. */
  atStatus: number;
  /** Total active (non-cancelled/rejected) items. */
  total: number;
  /** Count of active items per status. */
  counts: Record<string, number>;
  /** Human label, e.g. "Partially Processing (2/4)". */
  label: string;
}

/**
 * Derive the order-level display status from its item statuses.
 * - all items same status  -> that status (today's behaviour)
 * - diverged               -> furthest-progressed non-Delivered status + "n/total"
 * - "Delivered" only when every active item is delivered
 */
export function rollupStatus(itemStatuses: string[], fallback: string): Rollup {
  const active = itemStatuses.filter(isActive);
  const counts: Record<string, number> = {};
  for (const s of itemStatuses) counts[s] = (counts[s] ?? 0) + 1;

  if (active.length === 0) {
    const s = (itemStatuses[0] ?? fallback) as ItemStatus;
    return {
      status: s,
      split: false,
      atStatus: itemStatuses.length,
      total: 0,
      counts,
      label: STATUS_LABEL[s] ?? s,
    };
  }

  const unique = Array.from(new Set(active));
  if (unique.length === 1) {
    const s = unique[0] as ItemStatus;
    return {
      status: s,
      split: false,
      atStatus: active.length,
      total: active.length,
      counts,
      label: STATUS_LABEL[s] ?? s,
    };
  }

  // Diverged: pick the furthest-progressed status that is not "delivered"
  // (an order isn't delivered until every item is).
  const sorted = unique
    .filter((s) => s !== "delivered")
    .sort((a, b) => stageIndex(b) - stageIndex(a));
  const status = (sorted[0] ?? "delivered") as ItemStatus;
  const atStatus = active.filter((s) => s === status).length;

  return {
    status,
    split: true,
    atStatus,
    total: active.length,
    counts,
    label: `Partially ${STATUS_LABEL[status] ?? status} (${atStatus}/${active.length})`,
  };
}
