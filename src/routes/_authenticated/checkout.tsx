import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { inr } from "@/lib/format";
import { placeOrder as placeOrderFn } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Sparkling Silver" }] }),
  component: Checkout,
});

function Checkout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [placed, setPlaced] = useState<{ id: string; order_no: string } | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: user?.email ?? "",
    customer_address: "",
    customer_city: "",
    customer_pincode: "",
    customer_notes: "",
  });

  const { data: items } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("id, quantity, size, product:products(*)")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const subtotal = (items ?? []).reduce(
    (s, it) => s + Number(it.product?.price ?? 0) * it.quantity,
    0,
  );
  const gst = subtotal * 0.03;
  const total = subtotal + gst;

  const placeOrderRpc = useServerFn(placeOrderFn);
  const placeOrder = useMutation({
    mutationFn: async () => placeOrderRpc({ data: form }),
    onSuccess: (order) => {
      setPlaced({ id: order.id, order_no: order.order_no });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: unknown) => {
      import("@/lib/errors").then(({ getErrorMessage }) =>
        toast.error(getErrorMessage(err, "Could not place order")),
      );
    },
  });

  if (placed) {
    const placedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const itemCount = (items ?? []).reduce((n, it) => n + it.quantity, 0);
    return (
      <MobileShell title="Order Placed">
        <div className="p-6 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-burgundy" />
          <h2 className="mt-4 font-serif text-2xl font-bold">Order Placed!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Order ID</p>
          <p className="font-serif text-xl font-semibold gold-text">{placed.order_no}</p>

          <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border bg-card p-4 text-left text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Date</span><span className="font-medium">{placedOn}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Items</span><span className="font-medium">{itemCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">Pending (To be confirmed)</span></div>
          </div>

          <div className="mx-auto mt-4 max-w-sm rounded-xl border border-burgundy/20 bg-burgundy/5 p-3 text-left text-xs text-burgundy">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Our team will review your order and contact you to confirm pricing, payment & delivery. You'll get updates in-app at each stage.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="bg-burgundy hover:bg-burgundy/90">
              <Link to="/orders/$id" params={{ id: placed.id }}>View Order Details</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/orders">My Orders</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/catalogue">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </MobileShell>
    );
  }

  if (!items || items.length === 0) {
    return (
      <MobileShell title="Checkout">
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild className="mt-4">
            <Link to="/catalogue">Continue Shopping</Link>
          </Button>
        </div>
      </MobileShell>
    );
  }

  const valid =
    form.customer_name.trim() &&
    form.customer_phone.trim().length >= 8 &&
    /.+@.+\..+/.test(form.customer_email) &&
    form.customer_address.trim() &&
    form.customer_city.trim() &&
    form.customer_pincode.trim().length >= 4;

  return (
    <MobileShell title="Place Order">
      <form
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast.error("Please fill all required fields");
          placeOrder.mutate();
        }}
      >
        <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 p-3 text-xs text-burgundy">
          No online payment. We'll review your order and contact you to confirm
          pricing, payment & delivery.
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" required maxLength={100}
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">WhatsApp / Phone *</Label>
              <Input id="phone" inputMode="tel" required maxLength={20}
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" required maxLength={200}
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="addr">Delivery address *</Label>
            <Textarea id="addr" required maxLength={500} rows={2}
              value={form.customer_address}
              onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input id="city" required maxLength={80}
                value={form.customer_city}
                onChange={(e) => setForm({ ...form, customer_city: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="pin">Pincode *</Label>
              <Input id="pin" inputMode="numeric" required maxLength={10}
                value={form.customer_pincode}
                onChange={(e) => setForm({ ...form, customer_pincode: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" maxLength={1000} rows={2}
              placeholder="Anything we should know about your order"
              value={form.customer_notes}
              onChange={(e) => setForm({ ...form, customer_notes: e.target.value })} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Items" value={String(items.length)} />
          <Row label="Subtotal" value={inr(subtotal)} />
          <Row label="GST (3%)" value={inr(gst)} />
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Estimated total</span>
            <span className="font-serif text-burgundy">{inr(total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Final price will be confirmed by our team based on current gold rate.
          </p>
        </div>

        <Button
          type="submit"
          disabled={placeOrder.isPending || !valid}
          className="h-12 w-full bg-burgundy hover:bg-burgundy/90"
        >
          {placeOrder.isPending ? "Placing…" : "Place Order"}
        </Button>
      </form>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
