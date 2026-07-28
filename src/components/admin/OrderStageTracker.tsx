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

/** Distinct colour per stage, matching the status badges. */
const STAGE_TONE: Record<
  OrderStatus | string,
  { dot: string; ring: string; text: string; bar: string }
> = {
  pending: { dot: "bg-sky-500", ring: "ring-sky-200", text: "text-sky-700", bar: "bg-sky-400" },
  accepted: {
    dot: "bg-indigo-500",
    ring: "ring-indigo-200",
    text: "text-indigo-700",
    bar: "bg-indigo-400",
  },
  confirmed: {
    dot: "bg-blue-600",
    ring: "ring-blue-200",
    text: "text-blue-700",
    bar: "bg-blue-400",
  },
  processing: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    text: "text-amber-700",
    bar: "bg-amber-400",
  },
  dispatched: {
    dot: "bg-violet-500",
    ring: "ring-violet-200",
    text: "text-violet-700",
    bar: "bg-violet-400",
  },
  out_for_delivery: {
    dot: "bg-orange-500",
    ring: "ring-orange-200",
    text: "text-orange-700",
    bar: "bg-orange-400",
  },
  delivered: {
    dot: "bg-emerald-600",
    ring: "ring-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  },
};

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
        const tone = STAGE_TONE[s.key] ?? {
          dot: "bg-green-700",
          ring: "ring-green-200",
          text: "text-green-700",
          bar: "bg-green-700",
        };
        const nextTone = STAGE_TONE[STAGES[i + 1]?.key] ?? tone;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1 min-w-max">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                  done
                    ? `${tone.dot} text-white`
                    : active
                      ? `${tone.dot} text-white ring-4 ${tone.ring}`
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[9px] leading-tight text-center ${
                  active ? `font-semibold ${tone.text}` : done ? tone.text : "text-muted-foreground"
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
              <span
                className={`mb-6 h-0.5 flex-1 ${i < current ? nextTone.bar : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default OrderStageTracker;
