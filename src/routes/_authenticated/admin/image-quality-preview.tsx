import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { productThumbUrl, productLqipUrl } from "@/lib/product-images";

export const Route = createFileRoute("/_authenticated/admin/image-quality-preview")({
  component: ImageQualityPreview,
});

type Variant = {
  label: string;
  url: string;
  bytes: number | null;
  ms: number | null;
};

type Row = {
  sku: string;
  name: string;
  original: string;
  variants: Variant[];
};

const PILOT_SKUS = [
  "AR(LS)-482", // heavy antique long-set
  "AR(NK)-599", // antique necklace w/ bust
  "AR(BJ)-09",  // baju
  "AR(BT)-09",  // antique belt
  "AR(BT)-109", // CZ belt
  "AR(CH)-99",  // choker
  "AR(LS)-138", // long-set
  "AR(NK)-514", // necklace
  "AR(PS)-412", // pendant set
  "BT 154",     // plain
];

async function measure(url: string): Promise<{ bytes: number | null; ms: number | null }> {
  try {
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    const buf = await r.arrayBuffer();
    return { bytes: buf.byteLength, ms: Math.round(performance.now() - t0) };
  } catch {
    return { bytes: null, ms: null };
  }
}

function fmtKb(b: number | null) {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function ImageQualityPreview() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["pilot-preview", PILOT_SKUS],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("sku, name, image_url")
        .in("sku", PILOT_SKUS);
      return data ?? [];
    },
  });

  const rows = useMemo<Row[]>(() => {
    return (products ?? [])
      .filter((p) => p.image_url && p.image_url.includes("/storage/v1/"))
      .map((p) => {
        const original = p.image_url as string;
        return {
          sku: p.sku,
          name: p.name,
          original,
          variants: [
            { label: "LQIP (w=24 q=20)", url: productLqipUrl(original), bytes: null, ms: null },
            { label: "Card (w=400 q=75)", url: productThumbUrl(original, { width: 400, quality: 75 }), bytes: null, ms: null },
            { label: "Detail (w=1200 q=80)", url: productThumbUrl(original, { width: 1200, quality: 80 }), bytes: null, ms: null },
            { label: "Original", url: original, bytes: null, ms: null },
          ],
        };
      });
  }, [products]);

  const [measured, setMeasured] = useState<Record<string, Variant[]>>({});

  useEffect(() => {
    if (!rows.length) return;
    let alive = true;
    (async () => {
      for (const r of rows) {
        const updated = await Promise.all(
          r.variants.map(async (v) => ({ ...v, ...(await measure(v.url)) })),
        );
        if (!alive) return;
        setMeasured((prev) => ({ ...prev, [r.sku]: updated }));
      }
    })();
    return () => { alive = false; };
  }, [rows]);

  return (
    <MobileShell title="Image Quality Preview">
      <div className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-bold">Image Quality Pilot — 10 SKUs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Side-by-side of Original vs. transformed Card / Detail / LQIP variants. Approve the
          quality here before we sweep it across the site.
        </p>

        {isLoading && <p className="mt-6 text-sm">Loading…</p>}

        <div className="mt-6 space-y-10">
          {rows.map((row) => {
            const variants = measured[row.sku] ?? row.variants;
            return (
              <section key={row.sku} className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-semibold">{row.sku} — {row.name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {variants.map((v) => (
                    <div key={v.label} className="space-y-2">
                      <div className="aspect-square w-full overflow-hidden bg-secondary">
                        <img
                          src={v.url}
                          alt={`${row.sku} ${v.label}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="text-[11px] leading-tight text-muted-foreground">
                        <div className="font-semibold text-foreground">{v.label}</div>
                        <div>Size: {fmtKb(v.bytes)}</div>
                        <div>Fetch: {v.ms == null ? "—" : `${v.ms} ms`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {!isLoading && rows.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            No pilot SKUs found with Storage-backed images. Update PILOT_SKUS in this file.
          </p>
        )}
      </div>
    </MobileShell>
  );
}
