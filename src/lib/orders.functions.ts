import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  recipient_name: z.string().trim().min(1).max(100),
  mobile: z.string().trim().min(8).max(15),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  pincode: z.string().trim().min(4).max(10),
});

const placeOrderInput = z.object({
  payment_method: z.enum(["upi", "card", "netbanking", "bank-transfer", "cod"]),
  address: addressSchema,
});

/**
 * Server-authoritative order placement.
 * - Re-reads cart_items + product prices server-side; never trusts client totals.
 * - Recomputes subtotal/gst/total.
 * - Persists shipping address (uses existing saved one if id provided).
 * - Inserts orders + order_items, clears cart, all under user RLS.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => placeOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Load cart with current product prices (server-side, authoritative).
    const { data: items, error: cartErr } = await supabase
      .from("cart_items")
      .select("id, quantity, size, product:products(id, name, sku, price, image_url, in_stock)")
      .eq("user_id", userId);
    if (cartErr) throw new Error(cartErr.message);
    if (!items || items.length === 0) throw new Error("Cart is empty");

    type CartRow = {
      id: string;
      quantity: number;
      size: string | null;
      product: {
        id: string;
        name: string;
        sku: string | null;
        price: number | string;
        image_url: string | null;
        in_stock: boolean | null;
      } | null;
    };
    const rows = items as unknown as CartRow[];

    for (const it of rows) {
      if (!it.product) throw new Error("A product in your cart is unavailable");
      if (it.product.in_stock === false) throw new Error(`${it.product.name} is out of stock`);
      if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new Error("Invalid quantity");
    }

    // 2. Recompute totals server-side.
    const subtotal = rows.reduce((s, it) => s + Number(it.product!.price) * it.quantity, 0);
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    // 3. Resolve shipping address — either existing (owned by user) or new.
    let shipping: Record<string, unknown> | null = null;
    if (data.address.id) {
      const { data: existing } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", data.address.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) throw new Error("Address not found");
      shipping = existing;
    } else {
      const { data: created, error: addrErr } = await supabase
        .from("addresses")
        .insert({
          user_id: userId,
          recipient_name: data.address.recipient_name,
          mobile: data.address.mobile,
          line1: data.address.line1,
          line2: data.address.line2 ?? null,
          city: data.address.city,
          state: data.address.state,
          pincode: data.address.pincode,
        })
        .select()
        .single();
      if (addrErr || !created) throw new Error(addrErr?.message ?? "Could not save address");
      shipping = created;
    }

    // 4. Insert order with server-computed totals.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal,
        gst,
        total,
        payment_method: data.payment_method,
        shipping_address: shipping,
      })
      .select()
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not create order");

    // 5. Order items at server-known unit prices.
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

    // 6. Clear cart.
    await supabase.from("cart_items").delete().eq("user_id", userId);

    return { id: order.id as string, order_no: order.order_no as string };
  });
