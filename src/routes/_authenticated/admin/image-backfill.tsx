import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { productThumbUrl } from "@/lib/product-images";
import { repairImageVariants } from "@/lib/image-variants.functions";

export const Route = createFileRoute("/_authenticated/admin/image-backfill")({
  head: () => ({ meta: [{ title: "Admin — Image Backfill" }] }),
  component: BackfillPage,
});

type Row = { id: string; sku: string; image_url: string | null };
// 10 years — matches original product image signed-URL expiry.
const SIGN_EXPIRES = 60 * 60 * 24 * 365 * 10;

const SIZES: Array<{ key: "thumb" | "card" | "detail"; width: number; quality: number }> = [
  { key: "thumb", width: 300, quality: 75 },
  { key: "card", width: 600, quality: 78 },
  { key: "detail", width: 1200, quality: 80 },
];

const BUCKET = "product-images";

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

async function canvasToWebp(
  img: HTMLImageElement,
  width: number,
  quality: number,
): Promise<Blob> {
  const scale = width / img.naturalWidth;
  const w = width;
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
      "image/webp",
      quality / 100,
    );
  });
}

function variantPath(originalImageUrl: string, sizeKey: string): string {
  // Strip query string BEFORE splitting on `/`, otherwise "?token=..." bleeds
  // into the filename. Then swap the extension to `.webp`.
  const beforeQuery = originalImageUrl.split(/[?#]/)[0] ?? originalImageUrl;
  const base = beforeQuery.split("/").pop() ?? beforeQuery;
  let decoded = base;
  try { decoded = decodeURIComponent(base); } catch { /* keep raw */ }
  const stem = decoded.replace(/\.[^.]+$/, "");
  return `variants/${sizeKey}/${stem}.webp`;
}

function BackfillPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<Array<{ sku: string; err: string }>>([]);
  const [running, setRunning] = useState(false);
  const [currentSku, setCurrentSku] = useState<string>("");
  const [batchSize] = useState(5);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{ updated: number; failed: number } | null>(null);
  const repair = useServerFn(repairImageVariants);
  const abortRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const { data, count } = await supabase
        .from("products")
        .select("id, sku, image_url", { count: "exact" })
        .is("image_variants", null)
        .not("image_url", "is", null)
        .order("sku", { ascending: true });
      setRows((data ?? []) as Row[]);
      setTotal(count ?? 0);
    })();
  }, []);

  async function processOne(row: Row): Promise<void> {
    if (!row.image_url) throw new Error("no image_url");
    // Load the full-resolution original via the render endpoint at max width
    // to bypass any tiny cached thumbnail.
    const sourceUrl = row.image_url.includes("/storage/v1/")
      ? productThumbUrl(row.image_url, { width: 2048, quality: 90 })
      : row.image_url;
    const img = await loadImage(sourceUrl);

    const variants: Record<string, string> = {};
    for (const size of SIZES) {
      const blob = await canvasToWebp(img, size.width, size.quality);
      const path = variantPath(row.image_url, size.key);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
      if (upErr) throw new Error(`upload ${size.key}: ${upErr.message}`);
      // Bucket is private — sign with a long expiry (10 years) instead of
      // relying on getPublicUrl (which returns a non-loading URL for
      // private buckets).
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_EXPIRES);
      if (signErr || !signed?.signedUrl) throw new Error(`sign ${size.key}: ${signErr?.message ?? "no url"}`);
      variants[size.key] = signed.signedUrl;
    }

    const { error: updErr } = await supabase
      .from("products")
      .update({ image_variants: variants })
      .eq("id", row.id);
    if (updErr) throw new Error(`update row: ${updErr.message}`);
  }

  async function runBatch() {
    if (running) return;
    setRunning(true);
    abortRef.current = false;
    const queue = [...rows];
    while (queue.length && !abortRef.current) {
      const chunk = queue.splice(0, batchSize);
      await Promise.all(
        chunk.map(async (row) => {
          setCurrentSku(row.sku);
          try {
            await processOne(row);
            setDone((d) => d + 1);
            setRows((rs) => rs.filter((r) => r.id !== row.id));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setFailed((f) => [...f, { sku: row.sku, err: msg }]);
            setRows((rs) => rs.filter((r) => r.id !== row.id));
          }
        }),
      );
    }
    setRunning(false);
    setCurrentSku("");
    if (abortRef.current) toast.message("Backfill paused");
    else toast.success("Backfill complete");
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <MobileShell title="Image Backfill">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Image Backfill</h1>
          <Link to="/admin" className="text-sm text-teal underline">← Admin</Link>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
          <p><strong>{total}</strong> products need pre-resized WebP variants.</p>
          <p>Remaining: <strong>{rows.length}</strong> · Done this session: <strong>{done}</strong> · Failed: <strong>{failed.length}</strong></p>
          <p className="text-xs text-gray-500">Generates 300w / 600w / 1200w WebPs from each product's stored image, uploads them to <code>variants/</code>, and links them via <code>image_variants</code>. Safe to close and resume — only rows with null <code>image_variants</code> are processed.</p>
          {currentSku && <p className="text-xs">Current: <code>{currentSku}</code></p>}
          <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!running ? (
            <Button onClick={runBatch} disabled={rows.length === 0}>
              {rows.length === 0 ? "All done" : `Start (${rows.length} remaining)`}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => (abortRef.current = true)}>
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            disabled={repairing || running}
            onClick={async () => {
              setRepairing(true);
              setRepairResult(null);
              try {
                const r = await repair();
                setRepairResult({ updated: r.updated, failed: r.failed });
                toast.success(`Repaired ${r.updated} · Failed ${r.failed}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Repair failed");
              } finally {
                setRepairing(false);
              }
            }}
          >
            {repairing ? "Repairing URLs..." : "Repair variant URLs"}
          </Button>
        </div>

        {repairResult && (
          <p className="text-xs text-gray-600">
            Repair pass: updated <strong>{repairResult.updated}</strong> rows,
            failed <strong>{repairResult.failed}</strong>.
          </p>
        )}

        {failed.length > 0 && (
          <div className="rounded-lg border bg-white p-4 text-xs">
            <p className="font-bold mb-1">Failed ({failed.length})</p>
            <ul className="max-h-64 overflow-auto space-y-0.5">
              {failed.map((f, i) => (
                <li key={i}><code>{f.sku}</code> — {f.err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
