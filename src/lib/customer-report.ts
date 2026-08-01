import { supabase } from "@/integrations/supabase/client";

export const REPORT_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "processing",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "rejected",
  "cancelled",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type CustomerReportRow = {
  userId: string;
  businessName: string | null;
  contactPerson: string | null;
  username: string | null;
  email: string | null;
  mobile: string | null;
  city: string | null;
  businessType: string | null;
  gstin: string | null;
  accountStatus: string;
  profileCompleted: boolean;
  joinedAt: string;
  deliveryAddress: string | null;
  remarks: string | null;
  orders: number;
  skuLines: number;
  uniqueSkus: number;
  totalQty: number;
  grossWeight: number;
  netWeight: number;
  avgOrderWeight: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  cartItems: number;
  wishlistItems: number;
  statusOrders: Record<ReportStatus, number>;
  statusQty: Record<ReportStatus, number>;
  statusWeight: Record<ReportStatus, number>;
};

type ProfileRow = {
  id: string;
  business_name: string | null;
  contact_person: string | null;
  username: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  city: string | null;
  business_type: string | null;
  gstin: string | null;
  status: string;
  profile_completed: boolean;
  created_at: string;
  delivery_address: string | null;
  additional_remarks: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  order_items: {
    id: string;
    product_sku: string | null;
    quantity: number;
    gross_weight: number | string | null;
    net_weight: number | string | null;
    status: string;
  }[];
};

const zeroMap = () =>
  Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0])) as Record<ReportStatus, number>;

export type ReportFilters = { from?: string; to?: string };

/** Aggregates every buyer account with their lifetime order activity. */
export async function fetchCustomerReport(filters: ReportFilters = {}) {
  const fromTs = filters.from ? new Date(filters.from + "T00:00:00").getTime() : null;
  const toTs = filters.to ? new Date(filters.to + "T23:59:59").getTime() : null;

  const [profilesRes, ordersRes, cartRes, wishRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, business_name, contact_person, username, full_name, email, mobile, city, business_type, gstin, status, profile_completed, created_at, delivery_address, additional_remarks",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select(
        "id, user_id, status, created_at, order_items(id, product_sku, quantity, gross_weight, net_weight, status)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("cart_items").select("user_id, quantity"),
    supabase.from("wishlist_items").select("user_id"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];
  const orders = ((ordersRes.data ?? []) as unknown as OrderRow[]).filter((o) => {
    if (!fromTs && !toTs) return true;
    const t = new Date(o.created_at).getTime();
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    return true;
  });

  const cartByUser = new Map<string, number>();
  for (const c of cartRes.data ?? [])
    cartByUser.set(c.user_id, (cartByUser.get(c.user_id) ?? 0) + Number(c.quantity ?? 0));
  const wishByUser = new Map<string, number>();
  for (const w of wishRes.data ?? []) wishByUser.set(w.user_id, (wishByUser.get(w.user_id) ?? 0) + 1);

  const rows = new Map<string, CustomerReportRow>();
  const skuSets = new Map<string, Set<string>>();

  for (const p of profiles) {
    rows.set(p.id, {
      userId: p.id,
      businessName: p.business_name ?? p.full_name ?? null,
      contactPerson: p.contact_person ?? p.full_name ?? null,
      username: p.username,
      email: p.email,
      mobile: p.mobile,
      city: p.city,
      businessType: p.business_type,
      gstin: p.gstin,
      accountStatus: p.status,
      profileCompleted: p.profile_completed,
      joinedAt: p.created_at,
      deliveryAddress: p.delivery_address,
      remarks: p.additional_remarks,
      orders: 0,
      skuLines: 0,
      uniqueSkus: 0,
      totalQty: 0,
      grossWeight: 0,
      netWeight: 0,
      avgOrderWeight: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      cartItems: cartByUser.get(p.id) ?? 0,
      wishlistItems: wishByUser.get(p.id) ?? 0,
      statusOrders: zeroMap(),
      statusQty: zeroMap(),
      statusWeight: zeroMap(),
    });
    skuSets.set(p.id, new Set());
  }

  for (const o of orders) {
    const row = rows.get(o.user_id);
    if (!row) continue;
    row.orders += 1;
    if (!row.firstOrderAt || o.created_at < row.firstOrderAt) row.firstOrderAt = o.created_at;
    if (!row.lastOrderAt || o.created_at > row.lastOrderAt) row.lastOrderAt = o.created_at;
    if ((REPORT_STATUSES as readonly string[]).includes(o.status))
      row.statusOrders[o.status as ReportStatus] += 1;

    for (const i of o.order_items ?? []) {
      const qty = Number(i.quantity ?? 0);
      const gross = qty * Number(i.gross_weight ?? 0);
      const net = qty * Number(i.net_weight ?? 0);
      row.skuLines += 1;
      row.totalQty += qty;
      row.grossWeight += gross;
      row.netWeight += net;
      if (i.product_sku) skuSets.get(o.user_id)?.add(i.product_sku);
      const st = (i.status ?? o.status) as ReportStatus;
      if ((REPORT_STATUSES as readonly string[]).includes(st)) {
        row.statusQty[st] += qty;
        row.statusWeight[st] += gross;
      }
    }
  }

  for (const row of rows.values()) {
    row.uniqueSkus = skuSets.get(row.userId)?.size ?? 0;
    row.avgOrderWeight = row.orders ? row.grossWeight / row.orders : 0;
  }

  return [...rows.values()].sort((a, b) => b.grossWeight - a.grossWeight || b.orders - a.orders);
}

const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const oneLine = (v: string | null) => (v ? v.replace(/\s*\n+\s*/g, ", ").trim() : null);

/** Excel export: summary sheet + per-status breakdown sheet. */
export async function exportCustomerReportExcel(
  rows: CustomerReportRow[],
  filters: ReportFilters = {},
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sparkling Silver";
  const WT = "#,##0.000;(#,##0.000);-";

  const style = (ws: import("exceljs").Worksheet) => {
    const head = ws.getRow(1);
    head.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E5A3E" } };
    head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    head.height = 30;
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
    ws.eachRow({ includeEmpty: false }, (r, n) => {
      if (n > 1) r.font = { name: "Arial" };
    });
  };

  const s1 = wb.addWorksheet("Customer Summary");
  s1.columns = [
    { header: "Business Name", key: "biz", width: 26 },
    { header: "Contact Person", key: "person", width: 22 },
    { header: "Username", key: "username", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Mobile", key: "mobile", width: 15 },
    { header: "City", key: "city", width: 14 },
    { header: "Business Type", key: "type", width: 14 },
    { header: "GSTIN", key: "gstin", width: 18 },
    { header: "Account Status", key: "acct", width: 14 },
    { header: "Profile Completed", key: "profile", width: 15 },
    { header: "Joined On", key: "joined", width: 18, style: { numFmt: "dd-mmm-yyyy" } },
    { header: "Delivery Address", key: "address", width: 34 },
    { header: "Remarks", key: "remarks", width: 28 },
    { header: "Total Orders", key: "orders", width: 12 },
    { header: "SKU Lines", key: "lines", width: 11 },
    { header: "Unique SKUs", key: "uniq", width: 12 },
    { header: "Total Qty", key: "qty", width: 11 },
    { header: "Total Gross Wt (g)", key: "gross", width: 17, style: { numFmt: WT } },
    { header: "Total Net Wt (g)", key: "net", width: 16, style: { numFmt: WT } },
    { header: "Avg Gross Wt / Order (g)", key: "avg", width: 20, style: { numFmt: WT } },
    { header: "First Order", key: "first", width: 18, style: { numFmt: "dd-mmm-yyyy" } },
    { header: "Last Order", key: "last", width: 18, style: { numFmt: "dd-mmm-yyyy" } },
    { header: "Cart Qty (open)", key: "cart", width: 14 },
    { header: "Wishlist Items", key: "wish", width: 13 },
    ...REPORT_STATUSES.map((s) => ({
      header: `${label(s)} Orders`,
      key: `o_${s}`,
      width: 14,
    })),
  ];

  for (const r of rows) {
    s1.addRow({
      biz: r.businessName,
      person: r.contactPerson,
      username: r.username,
      email: r.email,
      mobile: r.mobile,
      city: r.city,
      type: r.businessType,
      gstin: r.gstin,
      acct: r.accountStatus,
      profile: r.profileCompleted ? "Yes" : "No",
      joined: new Date(r.joinedAt),
      address: oneLine(r.deliveryAddress),
      remarks: oneLine(r.remarks),
      orders: r.orders,
      lines: r.skuLines,
      uniq: r.uniqueSkus,
      qty: r.totalQty,
      gross: r.grossWeight || null,
      net: r.netWeight || null,
      avg: r.avgOrderWeight || null,
      first: r.firstOrderAt ? new Date(r.firstOrderAt) : null,
      last: r.lastOrderAt ? new Date(r.lastOrderAt) : null,
      cart: r.cartItems,
      wish: r.wishlistItems,
      ...Object.fromEntries(REPORT_STATUSES.map((s) => [`o_${s}`, r.statusOrders[s]])),
    });
  }

  const s2 = wb.addWorksheet("Status Breakdown");
  s2.columns = [
    { header: "Business Name", key: "biz", width: 26 },
    { header: "Email", key: "email", width: 28 },
    { header: "Mobile", key: "mobile", width: 15 },
    ...REPORT_STATUSES.flatMap((s) => [
      { header: `${label(s)} Qty`, key: `q_${s}`, width: 13 },
      { header: `${label(s)} Gross Wt (g)`, key: `w_${s}`, width: 18, style: { numFmt: WT } },
    ]),
    { header: "Total Qty", key: "qty", width: 11 },
    { header: "Total Gross Wt (g)", key: "gross", width: 17, style: { numFmt: WT } },
  ];
  for (const r of rows) {
    s2.addRow({
      biz: r.businessName,
      email: r.email,
      mobile: r.mobile,
      ...Object.fromEntries(
        REPORT_STATUSES.flatMap((s) => [
          [`q_${s}`, r.statusQty[s]],
          [`w_${s}`, r.statusWeight[s] || null],
        ]),
      ),
      qty: r.totalQty,
      gross: r.grossWeight || null,
    });
  }

  const s3 = wb.addWorksheet("Report Info");
  s3.columns = [
    { header: "Field", key: "k", width: 26 },
    { header: "Value", key: "v", width: 40 },
  ];
  s3.addRow({ k: "Generated At", v: new Date().toLocaleString("en-IN") });
  s3.addRow({ k: "Date Range", v: filters.from || filters.to ? `${filters.from || "start"} to ${filters.to || "today"}` : "All time" });
  s3.addRow({ k: "Customer Accounts", v: rows.length });
  s3.addRow({ k: "Total Orders", v: rows.reduce((s, r) => s + r.orders, 0) });
  s3.addRow({ k: "Total Qty", v: rows.reduce((s, r) => s + r.totalQty, 0) });
  s3.addRow({
    k: "Total Gross Weight (g)",
    v: Number(rows.reduce((s, r) => s + r.grossWeight, 0).toFixed(3)),
  });

  for (const ws of [s1, s2, s3]) style(ws);

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparkling-silver-customer-report-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  return { customers: rows.length };
}
