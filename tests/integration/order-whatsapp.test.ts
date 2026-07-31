import { describe, it, expect } from "vitest";
import { buildOrderWhatsAppMessage, buildOrderWhatsAppUrl } from "../../src/lib/order-whatsapp";
import { WHATSAPP_NUMBER } from "../../src/lib/site";

const input = {
  orderNo: "SS-1042",
  items: [
    { sku: "AR(NK)-529", name: "Antique Necklace", quantity: 2, size: "16", remark: "Polish matte" },
    { sku: null, name: "CZ Jhumka", quantity: 1, size: null, remark: null },
  ],
  totalPieces: 3,
  totalGrossWeight: 84.5,
  address: "  12 Park Street, Kolkata  ",
  notes: "  Deliver before Diwali  ",
};

describe("order WhatsApp hand-off", () => {
  it("includes order no, every SKU with qty/size/remarks, totals, address and notes", () => {
    const msg = buildOrderWhatsAppMessage(input);
    expect(msg).toContain("order SS-1042");
    expect(msg).toContain("1. AR(NK)-529 × 2 | Size: 16 | Item Remarks: Polish matte");
    expect(msg).toContain("2. CZ Jhumka × 1");
    expect(msg).toContain("Total pieces: 3");
    expect(msg).toContain("Approx. gross weight: 84.50 g");
    expect(msg).toContain("Delivery address: 12 Park Street, Kolkata");
    expect(msg).toContain("Notes: Deliver before Diwali");
    expect(msg).toContain("Please confirm my order.");
  });

  it("omits address and notes lines when empty", () => {
    const msg = buildOrderWhatsAppMessage({ ...input, address: "   ", notes: null });
    expect(msg).not.toContain("Delivery address:");
    expect(msg).not.toContain("Notes:");
  });

  it("targets the shop WhatsApp number with an encoded message", () => {
    const url = buildOrderWhatsAppUrl(input);
    expect(url.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(buildOrderWhatsAppMessage(input));
  });
});
