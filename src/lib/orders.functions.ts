import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const placeOrderInput = z.object({
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().trim().min(8).max(20),
  customer_email: z.string().trim().email().max(200),
  customer_address: z.string().trim().min(1).max(500),
  customer_city: z.string().trim().min(1).max(80),
  customer_pincode: z.string().trim().min(4).max(10),
  customer_notes: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Manual order placement — no payment.
 * - Server-authoritative totals.
 * - Status defaults to `pending`; admin accepts/rejects later.
 * - Fans out a Web Push notification to all admins after insert.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => placeOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: items, error: cartErr } = await supabase
      .from("cart_items")
      .select("id, quantity, size, product:products(id, name, sku, price, image_url, in_stock)")
      .eq("user_id", userId);
    if (cartErr) throw new Error(cartErr.message);
    if (!items || items.length === 0) throw new Error("Cart is empty");

    type CartRow = {
      id: string; quantity: number; size: string | null;
      product: { id: string; name: string; sku: string | null; price: number | string; image_url: string | null; in_stock: boolean | null } | null;
    };
    const rows = items as unknown as CartRow[];
    for (const it of rows) {
      if (!it.product) throw new Error("A product in your cart is unavailable");
      if (it.product.in_stock === false) throw new Error(`${it.product.name} is out of stock`);
      if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new Error("Invalid quantity");
    }

    const subtotal = rows.reduce((s, it) => s + Number(it.product!.price) * it.quantity, 0);
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const shipping = {
      recipient_name: data.customer_name,
      mobile: data.customer_phone,
      line1: data.customer_address,
      city: data.customer_city,
      state: "",
      pincode: data.customer_pincode,
    };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal, gst, total,
        status: "pending",
        payment_method: null,
        shipping_address: shipping as never,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        customer_address: data.customer_address,
        customer_city: data.customer_city,
        customer_pincode: data.customer_pincode,
        customer_notes: data.customer_notes ?? null,
      })
      .select()
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not create order");

    const { error: itemsErr } = await supabase.from("order_items").insert(
      rows.map((it) => ({
        order_id: order.id,
        product_id: it.product!.id,
        product_name: it.product!.name,
        product_sku: it.product!.sku,
        image_url: it.product!.image_url,
        quantity: it.quantity,
        unit_price: Number(it.product!.price),
        size: it.size,
      })),
    );
    if (itemsErr) throw new Error(itemsErr.message);

    await supabase.from("cart_items").delete().eq("user_id", userId);

    // Fire-and-forget push to admins
    notifyAdmins({
      title: "New order received",
      body: `${data.customer_name} · ${rows.length} item${rows.length > 1 ? "s" : ""} · ₹${total.toFixed(0)}`,
      url: `/admin/orders/${order.id}`,
      tag: `order-${order.id}`,
    }).catch(() => {});

    return { id: order.id as string, order_no: order.order_no as string };
  });
