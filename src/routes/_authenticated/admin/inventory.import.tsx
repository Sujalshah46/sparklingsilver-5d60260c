import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateStock } from "@/lib/inventory.functions";

export const Route = createFileRoute("/_authenticated/admin/inventory/import")({
  head: () => ({ meta: [{ title: "Admin — Import inventory" }] }),
  component: ImportPage,
});

type Row = { sku: string; quantity: number; line: number };
type RowError = { line: number; raw: string; error: string };
type ResultRow = { sku: string; status: "updated" | "not_found" | "failed"; previous?: number; next?: number; error?: string };

function parseCSV(text: string): { rows: Row[]; errors: RowError[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: [] };
  // skip header if it looks like one
  const first = lines[0].toLowerCase();
  const startIdx = (first.includes("sku") && first.includes("quantity")) || first.includes("qty") ? 1 : 0;
  const rows: Row[] = [];
  const errors: RowError[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) { errors.push({ line: i + 1, raw: line, error: "Need SKU,quantity" }); continue; }
    const sku = parts[0];
    const qty = parseInt(parts[1], 10);
    if (!sku) { errors.push({ line: i + 1, raw: line, error: "Empty SKU" }); continue; }
    if (Number.isNaN(qty) || qty < 0) { errors.push({ line: i + 1, raw: line, error: "Invalid quantity" }); continue; }
    rows.push({ sku, quantity: qty, line: i + 1 });
  }
  return { rows, errors };
}

function ImportPage() {
  const bulk = useServerFn(bulkUpdateStock);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number; results: ResultRow[] } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast.error("File too large (max 2 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCSV(text);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setResult(null);
      toast.success(`Parsed ${parsed.rows.length} rows`);
    };
    reader.readAsText(f);
  }

  async function submit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const r = await bulk({ data: { rows: rows.map((x) => ({ sku: x.sku, quantity: x.quantity })), reason: reason || null } });
      setResult({ updated: r.updated, notFound: r.notFound, results: r.results });
      toast.success(`Updated ${r.updated} · ${r.notFound} not found`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobileShell title="Import inventory">
      <div className="p-4 space-y-4">
        <Link to="/admin/inventory" className="text-xs text-muted-foreground hover:text-foreground">← Inventory</Link>
        <div>
          <h1 className="font-serif text-xl font-semibold">Bulk import (CSV)</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a CSV with columns <code className="rounded bg-secondary px-1">sku,quantity</code>. Existing rows are replaced (absolute set), and a stock movement is logged per change.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center">
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <label htmlFor="csv" className="cursor-pointer text-sm font-medium text-burgundy hover:underline">
            Choose CSV file
          </label>
          <input id="csv" type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <p className="mt-1 text-[11px] text-muted-foreground">Max 1000 rows · 2 MB</p>
        </div>

        <div>
          <Label htmlFor="reason">Reason (logged on every movement)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Weekly stocktake — Nov 26" />
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-900">
              <AlertCircle className="h-3.5 w-3.5" /> {errors.length} row{errors.length === 1 ? "" : "s"} skipped
            </p>
            <ul className="space-y-0.5 text-[11px] text-amber-900">
              {errors.slice(0, 5).map((e) => <li key={e.line}>Line {e.line}: {e.error}</li>)}
              {errors.length > 5 && <li>…and {errors.length - 5} more</li>}
            </ul>
          </div>
        )}

        {rows.length > 0 && !result && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> Preview ({rows.length} rows)
              </span>
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? "Importing…" : "Apply import"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary"><tr>
                  <th className="px-3 py-1.5 text-left">SKU</th>
                  <th className="px-3 py-1.5 text-right">Qty</th>
                </tr></thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.line} className="border-t border-border"><td className="px-3 py-1.5 font-mono">{r.sku}</td><td className="px-3 py-1.5 text-right">{r.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && <p className="p-2 text-center text-[11px] text-muted-foreground">…{rows.length - 100} more rows</p>}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex gap-3">
              <Badge className="bg-green-100 text-green-900"><CheckCircle2 className="mr-1 h-3 w-3" />{result.updated} updated</Badge>
              {result.notFound > 0 && <Badge className="bg-amber-100 text-amber-900"><XCircle className="mr-1 h-3 w-3" />{result.notFound} not found</Badge>}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary"><tr>
                  <th className="px-3 py-1.5 text-left">SKU</th><th className="px-3 py-1.5 text-left">Status</th><th className="px-3 py-1.5 text-right">Change</th>
                </tr></thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                      <td className="px-3 py-1.5">{r.status === "updated" ? <span className="text-green-700">updated</span> : <span className="text-amber-700">not found</span>}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{r.status === "updated" ? `${r.previous} → ${r.next}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
