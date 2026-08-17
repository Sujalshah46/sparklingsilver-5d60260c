import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const placeOrderInput = z.object({
  customer_address: z.string().trim().min(1).max(1000),
  customer_notes: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Manual order placement — no payment.
 * - Server-authoritative totals.
 * - Status defaults to `pending`; admin accepts/rejects later.
 * - Fans out a Web Push notification to all admins asynchronously in the background.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => placeOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // FIX #1: Use !inner join + explicit columns to resolve cart queries efficiently
    const { data: items, error: cartErr } = await supabase
      .from("cart_items")
      .select(
        "id, quantity, size, remark, " +
        "products!inner(id, name, sku, price, image_url, in_stock, gross_weight, net_weight)"
      )
      .eq("user_id", userId);

    if (cartErr) throw new Error(cartErr.message);
    if (!items || items.length === 0) throw new Error("Cart is empty");

    type CartRow = {
      id: string;
      quantity: number;
      size: string | null;
      remark: string | null;
      products: {
        id: string;
        name: string;
        sku: string | null;
        price: number | string;
        image_url: string | null;
        in_stock: boolean | null;
        gross_weight: number | string | null;
        net_weight: number | string | null;
      } | null;
    };

    const rows = items as unknown as CartRow[];

    // Validate cart items
    for (const it of rows) {
      if (!it.products) throw new Error("A product in your cart is unavailable");
      if (it.products.in_stock === false) throw new Error(`${it.products.name} is out of stock`);
      if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new Error("Invalid quantity");
      if (it.remark && it.remark.length > 500) throw new Error(`Remark for ${it.products.name} exceeds 500 characters`);
    }

    // FIX #2: Fetch profile with explicit columns
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, contact_person, mobile, email")
      .eq("id", userId)
      .maybeSingle();

    const customerName = (profile?.business_name || profile?.contact_person || "").trim();
    const customerPhone = (profile?.mobile || "").trim();
    const customerEmail = (profile?.email || "").trim();

    if (!customerName || !customerPhone || !customerEmail) {
      throw new Error("Please complete your profile before placing an order");
    }

    // Calculate totals
    const subtotal = rows.reduce((s, it) => s + Number(it.products!.price) * it.quantity, 0);
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    const shipping = {
      recipient_name: customerName,
      mobile: customerPhone,
      line1: data.customer_address,
      city: "",
      state: "",
      pincode: "",
    };

    // FIX #3: Create order (single insert)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal,
        gst,
        total,
        status: "pending",
        payment_method: null,
        shipping_address: shipping as never,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_address: data.customer_address,
        customer_notes: data.customer_notes ?? null,
      })
      .select()
      .single();

    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not create order");

    // FIX #4: Insert order items in batch
    const { error: itemsErr } = await supabase.from("order_items").insert(
      rows.map((it) => ({
        order_id: order.id,
        product_id: it.products!.id,
        product_name: it.products!.name,
        product_sku: it.products!.sku,
        image_url: it.products!.image_url,
        quantity: it.quantity,
        unit_price: Number(it.products!.price),
        gross_weight: it.products!.gross_weight != null ? Number(it.products!.gross_weight) : null,
        net_weight: it.products!.net_weight != null ? Number(it.products!.net_weight) : null,
        size: it.size,
        remark: it.remark ?? null,
      })),
    );

    if (itemsErr) {
      // Best-effort rollback so we never strand an empty order on the user's history.
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(itemsErr.message);
    }

    // FIX #5: Clear cart for this user
    const { error: cartClearErr } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId);
    if (cartClearErr) {
      // Order is already placed; surface a log but don't fail the request.
      console.error("[placeOrder] cart clear failed", cartClearErr);
    }

    // FIX #6: Queue push notification asynchronously so order completes instantly
    try {
      const { queueNotificationJob } = await import("./push-queue");
      queueNotificationJob("new-order", {
        orderId: order.id,
        orderNo: order.order_no,
        customerName,
        total,
      });
    } catch (e) {
      console.error("[placeOrder] push queue failed", e);
    }

    // Return the response matching what checkout.tsx expects
    return {
      id: order.id as string,
      order_no: order.order_no as string,
      subtotal,
      gst,
      total,
    };
  });

/**
 * Optimized cart fetching server function (resolves N+1 and selects specific columns)
 */
export const getCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: items, error } = await supabase
      .from("cart_items")
      .select(
        "id, quantity, size, remark, " +
        "products!inner(id, name, sku, price, image_url, gross_weight, net_weight)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    type CartRow = {
      id: string;
      quantity: number;
      size: string | null;
      remark: string | null;
      products: {
        id: string;
        name: string;
        sku: string | null;
        price: number | string;
        image_url: string | null;
        gross_weight: number | string | null;
        net_weight: number | string | null;
      };
    };

    const rows = (items ?? []) as unknown as CartRow[];

    if (rows.length === 0) {
      return { items: [], subtotal: 0, gst: 0, total: 0, itemCount: 0 };
    }

    const subtotal = rows.reduce((s, it) => s + Number(it.products.price) * it.quantity, 0);
    const gst = Math.round(subtotal * 0.03 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;

    return {
      items: rows.map((it) => ({
        id: it.id,
        quantity: it.quantity,
        size: it.size,
        remark: it.remark,
        product: it.products,
      })),
      subtotal,
      gst,
      total,
      itemCount: rows.length,
    };
  });

