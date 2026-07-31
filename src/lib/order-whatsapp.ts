import { whatsappUrl } from "@/lib/site";

export type OrderWhatsAppItem = {
  sku?: string | null;
  name?: string | null;
  quantity: number;
  size?: string | null;
  remark?: string | null;
};

export type OrderWhatsAppInput = {
  orderNo: string;
  items: OrderWhatsAppItem[];
  totalPieces: number;
  totalGrossWeight: number;
  address?: string | null;
  notes?: string | null;
};

/** Full order summary that is sent to the shop's WhatsApp right after an order is placed. */
export function buildOrderWhatsAppMessage(input: OrderWhatsAppInput): string {
  const lines = input.items.map((it, idx) => {
    const bits = [`${idx + 1}. ${it.sku ?? it.name ?? "Item"} × ${it.quantity}`];
    if (it.size) bits.push(`Size: ${it.size}`);
    if (it.remark) bits.push(`Item Remarks: ${it.remark}`);
    return bits.join(" | ");
  });

  return [
    `Hello Sparkling Silver, I have just placed order ${input.orderNo}.`,
    "",
    ...lines,
    "",
    `Total pieces: ${input.totalPieces}`,
    `Approx. gross weight: ${input.totalGrossWeight.toFixed(2)} g`,
    input.address?.trim() ? `Delivery address: ${input.address.trim()}` : "",
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : "",
    "",
    "Please confirm my order.",
  ].join("\n");
}

export function buildOrderWhatsAppUrl(input: OrderWhatsAppInput): string {
  return whatsappUrl(buildOrderWhatsAppMessage(input));
}
