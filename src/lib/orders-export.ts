import { supabase } from "@/integrations/supabase/client";

const HEADER_FILL = "FF0E5A3E";

type ExportScope = {
  /** Order ids currently visible (order-wise) or owning a visible SKU row (SKU-wise). */
  orderIds: string[];
  /** When set (SKU-wise / status tab), only these order_item ids are exported. */
  itemIds?: string[];
  /** Used for the file name, e.g. "pending-order-wise". */
  label: string;
};

type ExportOrder = {
  id: string;
  order_no: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_city: string | null;
  customer_pincode: string | null;
  customer_address: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  tracking_number: string | null;
  order_items: {
    id: string;
    product_sku: string | null;
    product_name: string;
    size: string | null;
    quantity: number;
    gross_weight: number | string | null;
    net_weight: number | string | null;
    status: string;
    status_updated_at: string | null;
    remark: string | null;
    shipments?: { tracking_number: string | null; courier: string | null } | null;
  }[];
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const oneLine = (v: string | null) => (v ? v.replace(/\s*\n+\s*/g, ", ").trim() : null);

async function fetchOrders(orderIds: string[]) {
  const out: ExportOrder[] = [];
  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_no, status, created_at, customer_name, customer_phone, customer_email, customer_city, customer_pincode, customer_address, customer_notes, admin_notes, tracking_number, order_items(id, product_sku, product_name, size, quantity, gross_weight, net_weight, status, status_updated_at, remark, shipments(tracking_number, courier))",
      )
      .in("id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw error;
    out.push(...((data ?? []) as unknown as ExportOrder[]));
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export async function exportOrdersExcel(scope: ExportScope) {
  const ExcelJS = (await import("exceljs")).default;
  const orders = await fetchOrders(scope.orderIds);
  const keepItem = scope.itemIds ? new Set(scope.itemIds) : null;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sparkling Silver";

  const style = (ws: import("exceljs").Worksheet) => {
    const head = ws.getRow(1);
    head.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    head.height = 28;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  const orderSheet = wb.addWorksheet("Orders");
  orderSheet.columns = [
    { header: "Order No", key: "order_no", width: 18 },
    { header: "Order Date", key: "date", width: 20, style: { numFmt: "dd-mmm-yyyy hh:mm" } },
    { header: "Order Status", key: "status", width: 15 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Email", key: "email", width: 26 },
    { header: "City", key: "city", width: 14 },
    { header: "Pincode", key: "pincode", width: 11 },
    { header: "Address", key: "address", width: 34 },
    { header: "SKU Count", key: "sku_count", width: 11 },
    { header: "Total Qty", key: "qty", width: 11 },
    {
      header: "Total Gross Wt (g)",
      key: "gross",
      width: 17,
      style: { numFmt: "#,##0.000;(#,##0.000);-" },
    },
    { header: "Tracking No", key: "tracking", width: 18 },
    { header: "Customer Notes", key: "notes", width: 28 },
    { header: "Admin Notes", key: "admin_notes", width: 28 },
  ];

  const itemSheet = wb.addWorksheet("Order Items (SKU-wise)");
  itemSheet.columns = [
    { header: "Order No", key: "order_no", width: 18 },
    { header: "Order Date", key: "date", width: 20, style: { numFmt: "dd-mmm-yyyy hh:mm" } },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "City", key: "city", width: 14 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Product", key: "product", width: 30 },
    { header: "Size", key: "size", width: 10 },
    { header: "Qty", key: "qty", width: 8 },
    {
      header: "Gross Wt/pc (g)",
      key: "gross_pc",
      width: 15,
      style: { numFmt: "#,##0.000;(#,##0.000);-" },
    },
    {
      header: "Net Wt/pc (g)",
      key: "net_pc",
      width: 14,
      style: { numFmt: "#,##0.000;(#,##0.000);-" },
    },
    {
      header: "Total Gross Wt (g)",
      key: "gross_total",
      width: 17,
      style: { numFmt: "#,##0.000;(#,##0.000);-" },
    },
    { header: "Item Status", key: "status", width: 15 },
    { header: "Status Updated", key: "updated", width: 20, style: { numFmt: "dd-mmm-yyyy hh:mm" } },
    { header: "Item Remark", key: "remark", width: 34 },
    { header: "Shipment Tracking", key: "ship_tracking", width: 20 },
    { header: "Courier", key: "courier", width: 16 },
  ];

  let itemCount = 0;
  for (const o of orders) {
    const items = (o.order_items ?? []).filter((i) => !keepItem || keepItem.has(i.id));
    if (keepItem && items.length === 0) continue;
    const totalQty = items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
    const totalGross = items.reduce(
      (s, i) => s + Number(i.quantity ?? 0) * Number(i.gross_weight ?? 0),
      0,
    );
    orderSheet.addRow({
      order_no: o.order_no,
      date: new Date(o.created_at),
      status: o.status,
      customer: o.customer_name,
      phone: o.customer_phone,
      email: o.customer_email,
      city: o.customer_city,
      pincode: o.customer_pincode,
      address: oneLine(o.customer_address),
      sku_count: items.length,
      qty: totalQty,
      gross: totalGross || null,
      tracking: o.tracking_number,
      notes: oneLine(o.customer_notes),
      admin_notes: oneLine(o.admin_notes),
    });

    for (const i of items) {
      itemCount++;
      itemSheet.addRow({
        order_no: o.order_no,
        date: new Date(o.created_at),
        customer: o.customer_name,
        phone: o.customer_phone,
        city: o.customer_city,
        sku: i.product_sku,
        product: i.product_name,
        size: i.size,
        qty: Number(i.quantity ?? 0),
        gross_pc: num(i.gross_weight),
        net_pc: num(i.net_weight),
        gross_total: Number(i.quantity ?? 0) * Number(i.gross_weight ?? 0) || null,
        status: i.status,
        updated: i.status_updated_at ? new Date(i.status_updated_at) : null,
        remark: oneLine(i.remark),
        ship_tracking: i.shipments?.tracking_number ?? null,
        courier: i.shipments?.courier ?? null,
      });
    }
  }

  for (const ws of [orderSheet, itemSheet]) {
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n > 1) row.font = { name: "Arial" };
    });
    style(ws);
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `sparkling-silver-orders-${scope.label}-${stamp}.xlsx`;
  const url = URL.createObjectURL(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { orders: orderSheet.rowCount - 1, items: itemCount, name };
}
