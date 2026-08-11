import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { inr, formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import { lookupByBarcode, scanAdjustStock, scanCreateProduct, scanEditProduct } from "@/lib/scan.functions";
import { Camera, CameraOff, Minus, Plus, ScanLine, Search, PackagePlus, Pencil, X, Repeat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/scan")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Scan Inventory") }] }),
  component: ScanPage,
});

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  label_code?: string | null;
  gross_weight?: number | null;
  price: number;
  image_url: string | null;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
  updated_at?: string | null;
  description?: string | null;
  category_id?: string | null;
  categories?: { name: string } | null;
};

const LABEL_RE = /^[A-Z]{1,4}\([A-Z]{1,4}\)-\d+$/i;


type FeedEntry = {
  id: string;
  ts: number;
  barcode: string;
  action: "increment" | "decrement" | "edit" | "created" | "not_found" | "lookup";
  productName?: string;
  delta?: number;
  previous?: number;
  next?: number;
};

function ScanPage() {
  const qc = useQueryClient();
  const lookupFn = useServerFn(lookupByBarcode);
  const adjustFn = useServerFn(scanAdjustStock);
  const createFn = useServerFn(scanCreateProduct);
  const editFn = useServerFn(scanEditProduct);

  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Persistent auto-focus for hardware scanner
  useEffect(() => {
    inputRef.current?.focus();
    const iv = setInterval(() => {
      if (document.activeElement !== inputRef.current && !editing && !showCreate) {
        inputRef.current?.focus();
      }
    }, 1200);
    return () => clearInterval(iv);
  }, [editing, showCreate]);

  useEffect(() => {
    supabase.from("categories").select("id, name").order("name").then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  const flashOnce = (kind: "success" | "error") => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 350);
  };

  const beep = (ok: boolean) => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = ok ? 880 : 220;
      o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.05;
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 90);
    } catch { /* no-op */ }
    if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]);
  };

  const pushFeed = (e: Omit<FeedEntry, "id" | "ts">) => {
    setFeed((prev) => [{ id: crypto.randomUUID(), ts: Date.now(), ...e }, ...prev].slice(0, 15));
  };

  const handleBarcode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      const res = await lookupFn({ data: { barcode: code } });
      if (!res.found || !res.product) {
        beep(false); flashOnce("error");
        pushFeed({ barcode: code, action: "not_found" });
        setProduct(null);
        setNotFoundBarcode(code);
        setShowCreate(true);
        toast.error(`Not found: ${code}`);
        return;
      }
      const p = res.product as Product;
      if (bulkMode) {
        const r = await adjustFn({ data: { product_id: p.id, delta: 1, action_type: "increment", reason: "Bulk stock-take" } });
        beep(true); flashOnce("success");
        pushFeed({ barcode: code, action: "increment", productName: p.name, delta: 1, previous: r.previous, next: r.next });
        toast.success(`${p.name}: ${r.previous} → ${r.next}`);
        setProduct({ ...p, stock_quantity: r.next });
      } else {
        beep(true); flashOnce("success");
        pushFeed({ barcode: code, action: "lookup", productName: p.name });
        setProduct(p);
        setNotFoundBarcode(null);
        setShowCreate(false);
      }
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      beep(false); flashOnce("error");
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
      setBarcode("");
    }
  }, [busy, lookupFn, adjustFn, bulkMode, qc]);

  const submitInput = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcode(barcode);
  };

  const doAdjust = async (delta: number) => {
    if (!product) return;
    const action: "increment" | "decrement" = delta >= 0 ? "increment" : "decrement";
    try {
      const r = await adjustFn({ data: { product_id: product.id, delta, action_type: action } });
      beep(true); flashOnce("success");
      pushFeed({ barcode: product.barcode ?? "", action, productName: product.name, delta, previous: r.previous, next: r.next });
      toast.success(`Stock updated: ${r.previous} → ${r.next}`);
      setProduct({ ...product, stock_quantity: r.next });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <MobileShell title="Scan Inventory">
      <div className={`min-h-full p-4 space-y-4 transition-colors duration-200 ${flash === "success" ? "bg-green-50" : flash === "error" ? "bg-red-50" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-semibold flex items-center gap-2"><ScanLine className="h-5 w-5 text-burgundy" /> Scan Inventory</h1>
            <p className="text-[11px] text-muted-foreground">USB/Bluetooth scanner ready · camera fallback available</p>
          </div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        {/* Modes */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={bulkMode ? "default" : "outline"}
            onClick={() => setBulkMode((v) => !v)}
            className={bulkMode ? "bg-burgundy hover:bg-burgundy/90" : ""}
          >
            <Repeat className="mr-1 h-4 w-4" /> Bulk stock-take {bulkMode ? "ON" : "OFF"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setCameraOn((v) => !v)}>
            {cameraOn ? <><CameraOff className="mr-1 h-4 w-4" /> Stop camera</> : <><Camera className="mr-1 h-4 w-4" /> Use camera</>}
          </Button>
        </div>

        {/* Scanner input */}
        <form onSubmit={submitInput} className="rounded-xl border border-border bg-card p-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Barcode</Label>
          <div className="mt-1 flex gap-2">
            <Input
              ref={inputRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type barcode…"
              autoComplete="off"
              inputMode="text"
              className="flex-1"
            />
            <Button type="submit" size="sm" className="bg-burgundy hover:bg-burgundy/90">
              <Search className="mr-1 h-4 w-4" /> Look up
            </Button>
          </div>
        </form>

        {/* Camera scanner */}
        {cameraOn && (
          <CameraScanner
            onDetected={(code) => { handleBarcode(code); }}
            onClose={() => setCameraOn(false)}
          />
        )}

        {/* Product panel */}
        {product && !showCreate && (
          <ProductPanel
            product={product}
            editing={editing}
            categories={categories}
            onClose={() => { setProduct(null); inputRef.current?.focus(); }}
            onAdjust={doAdjust}
            onEditToggle={() => setEditing((v) => !v)}
            onEditSave={async (patch) => {
              try {
                await editFn({ data: { product_id: product.id, patch } });
                pushFeed({ barcode: product.barcode ?? "", action: "edit", productName: patch.name ?? product.name });
                toast.success("Product updated");
                setProduct({ ...product, ...patch });
                setEditing(false);
                qc.invalidateQueries({ queryKey: ["admin-products"] });
              } catch (e) { toast.error(getErrorMessage(e)); }
            }}
          />
        )}

        {/* Create form */}
        {showCreate && notFoundBarcode && (
          <CreatePanel
            barcode={notFoundBarcode}
            categories={categories}
            onCancel={() => { setShowCreate(false); setNotFoundBarcode(null); inputRef.current?.focus(); }}
            onCreate={async (payload) => {
              try {
                const r = await createFn({ data: { ...payload, barcode: notFoundBarcode } });
                beep(true); flashOnce("success");
                pushFeed({ barcode: notFoundBarcode, action: "created", productName: r.product.name });
                toast.success(`Added: ${r.product.name}`);
                setProduct(r.product as Product);
                setShowCreate(false);
                setNotFoundBarcode(null);
                qc.invalidateQueries({ queryKey: ["admin-products"] });
                qc.invalidateQueries({ queryKey: ["admin-stats"] });
              } catch (e) { toast.error(getErrorMessage(e)); }
            }}
          />
        )}

        {/* Feed */}
        <div>
          <h2 className="mb-2 font-serif text-sm font-semibold">Live scan history</h2>
          {feed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Scans will appear here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {feed.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.productName ?? f.barcode}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(new Date(f.ts).toISOString())} · {f.barcode}</p>
                  </div>
                  <FeedBadge entry={f} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function FeedBadge({ entry }: { entry: FeedEntry }) {
  const map: Record<FeedEntry["action"], { cls: string; label: string }> = {
    increment: { cls: "bg-green-100 text-green-900", label: `+${entry.delta} → ${entry.next}` },
    decrement: { cls: "bg-amber-100 text-amber-900", label: `${entry.delta} → ${entry.next}` },
    edit: { cls: "bg-blue-100 text-blue-900", label: "Edited" },
    created: { cls: "bg-purple-100 text-purple-900", label: "Created" },
    not_found: { cls: "bg-destructive/15 text-destructive", label: "Not found" },
    lookup: { cls: "bg-secondary text-foreground", label: "Lookup" },
  };
  const b = map[entry.action];
  return <Badge className={b.cls}>{b.label}</Badge>;
}

function ProductPanel({
  product, editing, categories, onClose, onAdjust, onEditToggle, onEditSave,
}: {
  product: Product;
  editing: boolean;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onAdjust: (delta: number) => void;
  onEditToggle: () => void;
  onEditSave: (patch: { name?: string; price?: number; description?: string | null; image_url?: string; category_id?: string | null; label_code?: string | null; gross_weight?: number }) => void;
}) {
  const [qty, setQty] = useState(1);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [desc, setDesc] = useState(product.description ?? "");
  const [image, setImage] = useState(product.image_url ?? "");
  const [catId, setCatId] = useState(product.category_id ?? "");
  const [labelCode, setLabelCode] = useState(product.label_code ?? "");
  const [grossWt, setGrossWt] = useState(product.gross_weight != null ? String(product.gross_weight) : "");

  useEffect(() => {
    setName(product.name); setPrice(String(product.price));
    setDesc(product.description ?? ""); setImage(product.image_url ?? "");
    setCatId(product.category_id ?? "");
    setLabelCode(product.label_code ?? "");
    setGrossWt(product.gross_weight != null ? String(product.gross_weight) : "");
  }, [product.id]);


  const stock = product.stock_quantity ?? 0;
  const low = (product.low_stock_threshold ?? 0) >= stock;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <img
          src={resolveProductImage(product.image_url, categoryPlaceholder)}
          alt={product.name}
          onError={(e) => { e.currentTarget.src = categoryPlaceholder; }}
          className="h-20 w-20 rounded-lg bg-secondary object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base font-semibold truncate">{product.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {product.sku} · {product.categories?.name ?? "—"}
          </p>
          <p className="font-serif text-sm text-burgundy mt-0.5">{inr(product.price)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge className={stock === 0 ? "bg-destructive/15 text-destructive" : low ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}>
              Stock {stock}
            </Badge>
            {product.label_code && <Badge variant="outline" className="font-mono">{product.label_code}</Badge>}
            {product.gross_weight != null && Number(product.gross_weight) > 0 && (
              <Badge variant="outline">GrossWt {Number(product.gross_weight).toFixed(3)}g</Badge>
            )}
            {product.updated_at && <span className="text-[10px] text-muted-foreground">Updated {formatDate(product.updated_at)}</span>}
          </div>

        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {!editing ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Label className="text-[11px]">Qty</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-20 h-8" />
            <Button size="sm" onClick={() => onAdjust(qty)} className="bg-green-700 hover:bg-green-800 text-white">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAdjust(-qty)}>
              <Minus className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditToggle} className="ml-auto">
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <FieldRow label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
          <FieldRow label="Price"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></FieldRow>
          <FieldRow label="Category">
            <select value={catId} onChange={(e) => setCatId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FieldRow>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Label code">
              <Input value={labelCode} onChange={(e) => setLabelCode(e.target.value.toUpperCase())} placeholder="AR(CH)-196" className="font-mono" />
            </FieldRow>
            <FieldRow label="Gross wt (g)">
              <Input type="number" step="0.001" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} placeholder="156.000" />
            </FieldRow>
          </div>
          <FieldRow label="Image URL"><Input value={image} onChange={(e) => setImage(e.target.value)} /></FieldRow>
          <FieldRow label="Description">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full rounded-md border border-input bg-transparent p-2 text-sm" />
          </FieldRow>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEditSave({
              name, price: Number(price) || 0, description: desc || null,
              image_url: image || "/placeholder.svg",
              category_id: catId || null,
              label_code: labelCode.trim() ? labelCode.trim() : null,
              gross_weight: grossWt ? Number(grossWt) : undefined,
            })} className="bg-burgundy hover:bg-burgundy/90">Save</Button>
            <Button size="sm" variant="outline" onClick={onEditToggle}>Cancel</Button>
          </div>

        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CreatePanel({
  barcode, categories, onCancel, onCreate,
}: {
  barcode: string;
  categories: { id: string; name: string }[];
  onCancel: () => void;
  onCreate: (p: { name: string; sku: string; price: number; stock_quantity: number; description?: string | null; image_url: string; category_id?: string | null; label_code?: string | null; gross_weight?: number | null }) => void;
}) {
  const scannedIsLabel = LABEL_RE.test(barcode);
  const [name, setName] = useState("");
  const [sku, setSku] = useState(barcode);
  const [stock, setStock] = useState("1");
  const [image, setImage] = useState("/placeholder.svg");
  const [catId, setCatId] = useState("");
  const [grossWt, setGrossWt] = useState("");

  return (
    <div className="rounded-xl border border-dashed border-burgundy/40 bg-burgundy/5 p-3">
      <div className="flex items-center justify-between">
        <p className="font-serif text-sm font-semibold flex items-center gap-1.5">
          <PackagePlus className="h-4 w-4 text-burgundy" /> Product not found — add new?
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Barcode: <span className="font-mono">{barcode}</span>
        {scannedIsLabel && <span className="ml-1 text-burgundy">· printed label detected</span>}
      </p>
      <div className="mt-3 space-y-2">
        <FieldRow label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="SKU">
            <Input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="AR(CH)-196" className="font-mono" />
          </FieldRow>
          <FieldRow label="Gross wt (g)">
            <Input type="number" step="0.001" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} placeholder="156.000" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Initial stock"><Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} /></FieldRow>
          <FieldRow label="Category">
            <select value={catId} onChange={(e) => setCatId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FieldRow>
        </div>
        <FieldRow label="Image URL"><Input value={image} onChange={(e) => setImage(e.target.value)} /></FieldRow>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => {
            if (!name.trim() || !sku.trim()) { toast.error("Name and SKU are required"); return; }
            const skuTrimmed = sku.trim();
            onCreate({
              name: name.trim(),
              sku: skuTrimmed,
              price: 0,
              stock_quantity: Number(stock) || 0,
              description: null,
              image_url: image || "/placeholder.svg",
              category_id: catId || null,
              label_code: LABEL_RE.test(skuTrimmed) ? skuTrimmed : null,
              gross_weight: grossWt ? Number(grossWt) : null,
            });
          }} className="bg-burgundy hover:bg-burgundy/90">Create product</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>

      </div>
    </div>
  );
}

function CameraScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const containerId = "scan-camera-region";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ code: string; ts: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decoded: string) => {
            const now = Date.now();
            if (lastRef.current && lastRef.current.code === decoded && now - lastRef.current.ts < 1500) return;
            lastRef.current = { code: decoded, ts: now };
            onDetected(decoded);
          },
          () => { /* ignore per-frame errors */ }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
      }
    };
  }, [onDetected]);

  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium">Camera scanner</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div id={containerId} className="w-full overflow-hidden rounded-lg bg-black" />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
