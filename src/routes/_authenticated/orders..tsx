
type ItemRow = {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  size: string | null;
  image_url: string | null;
  status: string;
  shipment_id: string | null;
  gross_weight?: number | string | null;
  remark?: string | null;
  status_updated_at?: string | null;
  item_status_history?: { to_status: string; changed_at: string }[] | null;
};

function ItemCard({
  item,
  fallbackStatus,
  tracking,
}: {
  item: ItemRow;
  fallbackStatus: string;
  tracking: string | null;
}) {
  const [open, setOpen] = useState(false);
  const st = item.status ?? fallbackStatus;
  const idx = TIMELINE.findIndex((t) => t.key === st);
  const cancelled = st === "cancelled" || st === "rejected";

  // Earliest timestamp per stage from this item's own history.
  const when: Record<string, string> = {};
  for (const h of item.item_status_history ?? []) {
    if (!h?.to_status || !h?.changed_at) continue;
    if (!(h.to_status in when)) when[h.to_status] = h.changed_at;
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full gap-3 p-3 text-left"
      >
        <img
          src={resolveProductImage(item.image_url)}
          alt={item.product_name}
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 font-serif text-sm font-semibold">{item.product_name}</p>
            <Badge
              data-testid={`item-status-${item.id}`}
              variant="secondary"
              className={`shrink-0 text-[10px] capitalize ${statusBadgeClass(st)}`}
            >
              {ITEM_STATUS_LABEL[st] ?? st}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            SKU {item.product_sku} · Qty {item.quantity}
            {item.size ? ` · Size ${item.size}` : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Gross:</span>{" "}
            {Number(item.gross_weight ?? 0).toFixed(3)} g
          </p>
          {item.remark && (
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary p-2 text-[11px]">
              <span className="font-semibold">Item Remarks: </span>
              {item.remark}
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-burgundy">
            {open ? "Hide" : "View"} order timeline
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {tracking && (
            <p className="mb-3 rounded-md bg-secondary p-2 text-[11px]">
              <span className="font-semibold">Tracking / AWB: </span>
              <span className="font-mono">{tracking}</span>
            </p>
          )}
          {cancelled ? (
            <p className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              This item was {st === "rejected" ? "not accepted" : "cancelled"}.
            </p>
          ) : (
            <ol className="space-y-3">
              {TIMELINE.map((s, i) => {
                const done = idx >= 0 && i <= idx;
                const current = i === idx;
                const Icon = done ? s.Icon : Circle;
                const at = when[s.key];
                return (
                  <li key={s.key} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${done ? "border-burgundy bg-burgundy text-white" : "border-border bg-background text-muted-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${done ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.label}
                      </p>
                      {at && <p className="text-[11px] text-muted-foreground">{formatDate(at)}</p>}
                      {current && <p className="text-[11px] text-burgundy">Current status</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
