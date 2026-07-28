import { formatDate } from "@/lib/format";

export type OrderStatus =
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

export type StageHistoryEntry = { status: string; at: string };

export interface OrderStageTrackerProps {
  status: OrderStatus;
  /** Optional list of {status, at} entries. Missing/invalid entries are ignored gracefully. */
  history?: unknown;
  /** Optional per-status item counts — renders an "n/total" split indicator. */
  counts?: Record<string, number>;
  /** Total active items in the order. */
  totalItems?: number;
}

const STAGES: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Received" },
  { key: "accepted", label: "Reviewed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

/** Safe formatter: returns "" if input is missing/invalid instead of throwing. */
function safeStageTime(v: unknown): string {
  if (typeof v !== "string" || v.length === 0) return "";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return "";
  try {
    return formatDate(v);
  } catch {
    return "";
  }
}

/** Coerce an unknown value into a map of stage -> ISO string. Never throws. */
export function normalizeStageHistory(history: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(history)) return out;
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const status = typeof rec.status === "string" ? rec.status : null;
    const at = typeof rec.at === "string" ? rec.at : null;
    if (!status || !at) continue;
    // Keep the earliest timestamp per stage (first transition into that stage).
    if (!(status in out)) out[status] = at;
  }
  return out;
}

export function OrderStageTracker({ status, history, counts, totalItems }: OrderStageTrackerProps) {
  if (status === "rejected" || status === "cancelled") {
    const map = normalizeStageHistory(history);
    const when = safeStageTime(map[status]);
    return (
      <p className="mt-3 rounded-md bg-destructive/10 p-2 text-center text-xs font-medium capitalize text-destructive">
        Order {status}
        {when ? <span className="ml-1 font-normal opacity-80">· {when}</span> : null}
      </p>
    );
  }

  const map = normalizeStageHistory(history);
  const idx = STAGES.findIndex((s) => s.key === status);
  const current = idx < 0 ? 0 : idx;

  return (
    <ol className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const when = safeStageTime(map[s.key]);
        const at = counts?.[s.key] ?? 0;
        const split = !!totalItems && totalItems > 1 && at > 0 && at < totalItems;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1 min-w-max">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                  done
                    ? "bg-green-700 text-white"
                    : active
                      ? "bg-burgundy text-white ring-4 ring-burgundy/15"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[9px] leading-tight text-center ${
                  active ? "font-semibold text-burgundy" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              <span
                className={`text-[8px] leading-tight text-center ${
                  when ? "text-muted-foreground" : "text-transparent"
                }`}
                aria-hidden={!when}
              >
                {when || "—"}
              </span>
              {split && (
                <span className="rounded bg-gold/20 px-1 text-[8px] font-semibold leading-tight text-charcoal">
                  {at}/{totalItems}
                </span>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <span className={`mb-6 h-0.5 flex-1 ${i < current ? "bg-green-700" : "bg-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default OrderStageTracker;
