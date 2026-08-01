import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import {
  fetchCustomerReport,
  exportCustomerReportExcel,
  REPORT_STATUSES,
  type CustomerReportRow,
} from "@/lib/customer-report";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: pageTitle("Admin — Reports") }] }),
  component: AdminReports,
});

type SortKey = "gross" | "orders" | "qty" | "name" | "last";

const fmtWt = (g: number) =>
  `${g.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
const label = (s: string) => s.replace(/_/g, " ");

function AdminReports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("gross");
  const [activeOnly, setActiveOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customer-report", from, to],
    queryFn: () => fetchCustomerReport({ from: from || undefined, to: to || undefined }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (data ?? []).filter((r) => {
      if (activeOnly && r.orders === 0) return false;
      if (!q) return true;
      return [r.businessName, r.contactPerson, r.username, r.email, r.mobile, r.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === "orders") return b.orders - a.orders;
      if (sort === "qty") return b.totalQty - a.totalQty;
      if (sort === "name") return (a.businessName ?? "").localeCompare(b.businessName ?? "");
      if (sort === "last") return (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? "");
      return b.grossWeight - a.grossWeight;
    });
    return list;
  }, [data, search, sort, activeOnly]);

  const totals = useMemo(
    () => ({
      customers: rows.length,
      buyers: rows.filter((r) => r.orders > 0).length,
      orders: rows.reduce((s, r) => s + r.orders, 0),
      qty: rows.reduce((s, r) => s + r.totalQty, 0),
      gross: rows.reduce((s, r) => s + r.grossWeight, 0),
    }),
    [rows],
  );

  const handleExport = async () => {
    if (rows.length === 0) return toast.error("Nothing to export");
    setExporting(true);
    try {
      const res = await exportCustomerReportExcel(rows, {
        from: from || undefined,
        to: to || undefined,
      });
      toast.success(`Exported ${res.customers} customer accounts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <MobileShell title="Reports">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="font-serif text-xl font-semibold">Customer reports</h1>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search business, contact, email, mobile, city"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 flex-1 text-xs"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 flex-1 text-xs"
              aria-label="To date"
            />
            {(from || to || search || activeOnly) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setSearch("");
                  setActiveOnly(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeOnly ? "default" : "outline"}
              onClick={() => setActiveOnly((v) => !v)}
              className="h-8 text-xs"
            >
              With orders only
            </Button>
            <div className="inline-flex flex-wrap rounded-md bg-secondary p-1">
              {(
                [
                  ["gross", "Weight"],
                  ["orders", "Orders"],
                  ["qty", "Qty"],
                  ["last", "Recent"],
                  ["name", "A–Z"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    sort === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || isLoading}
              className="ml-auto h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Accounts", totals.customers.toString()],
            ["With orders", totals.buyers.toString()],
            ["Orders", totals.orders.toString()],
            ["Total qty", totals.qty.toString()],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{l}</p>
              <p className="font-serif text-lg font-semibold tabular-nums">{v}</p>
            </div>
          ))}
          <div className="col-span-2 rounded-xl border border-border bg-card p-3 sm:col-span-4">
            <p className="text-[11px] text-muted-foreground">Total gross weight</p>
            <p className="font-serif text-lg font-semibold tabular-nums">{fmtWt(totals.gross)}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Building report…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No customers match.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.userId} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpen((o) => (o === r.userId ? null : r.userId))}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-sm font-semibold">
                      {r.businessName ?? "—"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.contactPerson ?? "—"} · {r.mobile ?? "—"} · {r.city ?? "—"}
                    </p>
                    <p className="mt-1 text-[11px] tabular-nums">
                      <span className="font-semibold">{r.orders}</span> orders ·{" "}
                      <span className="font-semibold">{r.totalQty}</span> qty ·{" "}
                      <span className="font-semibold">{fmtWt(r.grossWeight)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="capitalize">
                      {r.accountStatus}
                    </Badge>
                    {open === r.userId ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {open === r.userId && <ReportDetail row={r} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}

function ReportDetail({ row: r }: { row: CustomerReportRow }) {
  const Line = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
  return (
    <div className="border-t border-border p-3 text-[11px]">
      <Line k="Username" v={r.username ?? "—"} />
      <Line k="Email" v={r.email ?? "—"} />
      <Line k="Business type" v={r.businessType ?? "—"} />
      <Line k="GSTIN" v={r.gstin ?? "—"} />
      <Line k="Profile completed" v={r.profileCompleted ? "Yes" : "No"} />
      <Line k="Joined" v={formatDate(r.joinedAt)} />
      <Line k="First order" v={r.firstOrderAt ? formatDate(r.firstOrderAt) : "—"} />
      <Line k="Last order" v={r.lastOrderAt ? formatDate(r.lastOrderAt) : "—"} />
      <Line k="SKU lines / unique SKUs" v={`${r.skuLines} / ${r.uniqueSkus}`} />
      <Line k="Net weight" v={fmtWt(r.netWeight)} />
      <Line k="Avg gross / order" v={fmtWt(r.avgOrderWeight)} />
      <Line k="Open cart qty" v={String(r.cartItems)} />
      <Line k="Wishlist items" v={String(r.wishlistItems)} />
      {r.deliveryAddress && <Line k="Delivery address" v={r.deliveryAddress} />}
      {r.remarks && <Line k="Remarks" v={r.remarks} />}
      <p className="mt-2 mb-1 font-semibold capitalize text-foreground">Status breakdown</p>
      {REPORT_STATUSES.filter(
        (s) => r.statusOrders[s] > 0 || r.statusQty[s] > 0 || r.statusWeight[s] > 0,
      ).map((s) => (
        <Line
          key={s}
          k={label(s)}
          v={`${r.statusOrders[s]} ord · ${r.statusQty[s]} qty · ${fmtWt(r.statusWeight[s])}`}
        />
      ))}
    </div>
  );
}
