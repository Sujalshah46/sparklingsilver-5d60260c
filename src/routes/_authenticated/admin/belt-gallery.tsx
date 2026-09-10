import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { productThumbUrl } from "@/lib/product-images";

export const Route = createFileRoute("/_authenticated/admin/belt-gallery")({
  component: BeltGallery,
});

/** Date the emerald velvet-cloth background rollout started. */
const VELVET_ROLLOUT_FROM = "2026-09-10T00:00:00.000Z";

type Filter = "all" | "velvet" | "older";

type BeltRow = {
  sku: string;
  name: string;
  image_url: string | null;
  updated_at: string;
  isVelvet: boolean;
};

function BeltGallery() {
  const [filter, setFilter] = useState<Filter>("velvet");
  const [zoom, setZoom] = useState<BeltRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["antique-belt-gallery"],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from("subcategories")
        .select("id, slug")
        .eq("slug", "belt");
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug")
        .eq("slug", "antique");
      const subId = subs?.[0]?.id;
      const catId = cats?.[0]?.id;
      if (!subId || !catId) return [] as BeltRow[];

      const { data: products } = await supabase
        .from("products")
        .select("sku, name, image_url, updated_at")
        .eq("subcategory_id", subId)
        .eq("category_id", catId)
        .order("sku");

      return (products ?? []).map((p) => ({
        sku: p.sku,
        name: p.name,
        image_url: p.image_url,
        updated_at: p.updated_at,
        isVelvet: new Date(p.updated_at).getTime() >= new Date(VELVET_ROLLOUT_FROM).getTime(),
      })) as BeltRow[];
    },
  });

  const rows = data ?? [];
  const velvetCount = rows.filter((r) => r.isVelvet).length;

  const visible = useMemo(() => {
    if (filter === "velvet") return rows.filter((r) => r.isVelvet);
    if (filter === "older") return rows.filter((r) => !r.isVelvet);
    return rows;
  }, [rows, filter]);

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All belts", count: rows.length },
    { key: "velvet", label: "Velvet background", count: velvetCount },
    { key: "older", label: "Older background", count: rows.length - velvetCount },
  ];

  return (
    <MobileShell title="Antique Belt Gallery">
      <div className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-bold">Antique Belts — Review Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check each belt's diagonal placement and velvet-cloth background. Tap a belt to open it
          large.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === c.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>

        {isLoading && <p className="mt-6 text-sm">Loading…</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((row) => (
            <button
              key={row.sku}
              type="button"
              onClick={() => setZoom(row)}
              className="group text-left"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-secondary">
                {row.image_url ? (
                  <img
                    src={productThumbUrl(row.image_url, { width: 500, quality: 78 })}
                    alt={`${row.sku} antique belt on emerald velvet background`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                {row.isVelvet && (
                  <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                    Velvet
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] leading-tight">
                <div className="font-semibold">{row.sku}</div>
                <div className="text-muted-foreground">
                  Updated {new Date(row.updated_at).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
        </div>

        {!isLoading && visible.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">Nothing in this filter.</p>
        )}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
          role="presentation"
        >
          <div className="max-h-full w-full max-w-3xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {zoom.image_url && (
              <img
                src={productThumbUrl(zoom.image_url, { width: 1400, quality: 85 })}
                alt={`${zoom.sku} full size`}
                className="w-full rounded-md"
              />
            )}
            <div className="mt-2 flex items-center justify-between text-sm text-white">
              <span className="font-semibold">
                {zoom.sku} — {zoom.name}
              </span>
              <button
                type="button"
                className="rounded border border-white/40 px-3 py-1 text-xs"
                onClick={() => setZoom(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
