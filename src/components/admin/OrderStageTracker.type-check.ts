/**
 * Compile-time smoke test for <OrderStageTracker />.
 *
 * This file exists to prevent TS2304-style regressions (missing symbol,
 * renamed export, broken prop contract). It intentionally has no runtime
 * assertions — the strict TS build IS the assertion. If any referenced
 * symbol disappears or a prop's type changes incompatibly, the build fails.
 *
 * Do not delete without adding an equivalent typed check elsewhere.
 */

import {
  OrderStageTracker,
  normalizeStageHistory,
  type OrderStageTrackerProps,
  type OrderStatus,
  type StageHistoryEntry,
} from "./OrderStageTracker";

// 1. The component export must exist and be callable as a React component.
const _component: (p: OrderStageTrackerProps) => unknown = OrderStageTracker;
void _component;

// 2. OrderStatus must cover every status the admin flow can set.
const _statuses: OrderStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "processing",
  "ready",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
void _statuses;

// 3. Props must accept: known status alone, status + typed history, and
//    unknown/garbage history (graceful fallback contract).
const _propsMinimal: OrderStageTrackerProps = { status: "pending" };
const _propsWithHistory: OrderStageTrackerProps = {
  status: "dispatched",
  history: [
    { status: "pending", at: "2026-01-01T00:00:00Z" },
    { status: "dispatched", at: "2026-01-02T00:00:00Z" },
  ] satisfies StageHistoryEntry[],
};
const _propsWithGarbage: OrderStageTrackerProps = {
  status: "delivered",
  history: "not-an-array",
};
const _propsWithNullHistory: OrderStageTrackerProps = {
  status: "delivered",
  history: null,
};
void _propsMinimal;
void _propsWithHistory;
void _propsWithGarbage;
void _propsWithNullHistory;

// 4. normalizeStageHistory must accept unknown and return a string map.
const _mapFromUnknown: Record<string, string> = normalizeStageHistory(null);
const _mapFromArray: Record<string, string> = normalizeStageHistory([
  { status: "pending", at: "2026-01-01T00:00:00Z" },
]);
void _mapFromUnknown;
void _mapFromArray;
