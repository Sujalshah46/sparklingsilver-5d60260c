import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Sparkling Jewellers" }] }),
  component: Checkout,
});

type Step = "address" | "payment" | "confirm";

function Checkout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("address");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [address, setAddress] = useState({ recipient_name: "", mobile: "", line1: "", line2: "", city: "", state: "", pincode: "" });

  const { data: items } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("cart_items").select("id, quantity, size, product:products(*)").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("addresses").select("*").eq("user_id", user!.id).order("is_default", { ascending: false });
      return data ?? [];
    },
  });

  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);

  const subtotal = (items ?? []).reduce((s, it) => s + Number(it.product?.price ?? 0) * it.quantity, 0);
  const gst = subtotal * 0.03;
  const total = subtotal + gst;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user || !items || items.length === 0) throw new Error("empty");
      let ship = addresses?.find((a) => a.id === selectedAddrId) ?? null;
      if (!ship) {
        // new address
        const { data: created } = await supabase.from("addresses").insert({ ...address, user_id: user.id }).select().single();
        ship = created;
      }
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          gst,
          total,
          payment_method: paymentMethod,
          shipping_address: ship,
        })
        .select()
        .single();
      if (error || !order) throw error;
      await supabase.from("order_items").insert(
        items.map((it) => ({
          order_id: order.id,
          product_id: it.product?.id,
          product_name: it.product?.name ?? "",
          product_sku: it.product?.sku,
          image_url: it.product?.image_url,
          quantity: it.quantity,
          unit_price: it.product?.price ?? 0,
          size: it.size,
        }))
      );
      await supabase.from("cart_items").delete().eq("user_id", user.id);
      return order;
    },
    onSuccess: (order) => {
      setOrderId(order.id);
      setOrderNo(order.order_no);
      setStep("confirm");
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => toast.error("Could not place order. Please try again."),
  });

  if ((!items || items.length === 0) && step !== "confirm") {
    return (
      <MobileShell title="Checkout">
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild className="mt-4"><Link to="/catalogue">Continue Shopping</Link></Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title="Checkout">
      <div className="p-4">
        <Steps step={step} />

        {step === "address" && (
          <div className="mt-6 space-y-4">
            {addresses && addresses.length > 0 && (
              <div>
                <Label className="font-semibold">Saved Addresses</Label>
                <RadioGroup value={selectedAddrId ?? ""} onValueChange={setSelectedAddrId} className="mt-2 space-y-2">
                  {addresses.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm has-[:checked]:border-burgundy">
                      <RadioGroupItem value={a.id} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{a.recipient_name} · {a.mobile}</p>
                        <p className="text-xs text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
            <details open={!addresses?.length}>
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">+ Add new address</summary>
              <div className="mt-3 grid gap-3">
                <Input placeholder="Recipient name" value={address.recipient_name} onChange={(e) => { setSelectedAddrId(null); setAddress({ ...address, recipient_name: e.target.value }); }} maxLength={100} />
                <Input placeholder="Mobile" value={address.mobile} onChange={(e) => setAddress({ ...address, mobile: e.target.value })} maxLength={15} />
                <Input placeholder="Address line 1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} maxLength={200} />
                <Input placeholder="Address line 2 (optional)" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} maxLength={200} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                  <Input placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                </div>
                <Input placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} maxLength={10} />
              </div>
            </details>
            <Button
              className="h-12 w-full bg-burgundy hover:bg-burgundy/90"
              onClick={() => {
                const hasSaved = !!selectedAddrId;
                const hasNew = address.recipient_name && address.mobile && address.line1 && address.city && address.state && address.pincode;
                if (!hasSaved && !hasNew) return toast.error("Choose or enter an address");
                setStep("payment");
              }}
            >
              Continue to Payment
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="mt-6 space-y-5">
            <div>
              <Label className="font-semibold">Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="mt-2 space-y-2">
                {[
                  { v: "upi", l: "UPI", h: "GPay, PhonePe, Paytm" },
                  { v: "card", l: "Credit / Debit Card", h: "Visa, Mastercard, RuPay" },
                  { v: "netbanking", l: "Net Banking", h: "All major banks" },
                  { v: "bank-transfer", l: "Bank Transfer", h: "NEFT / RTGS" },
                  { v: "cod", l: "Cash on Delivery", h: "Pay when delivered" },
                ].map((m) => (
                  <label key={m.v} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm has-[:checked]:border-burgundy">
                    <RadioGroupItem value={m.v} />
                    <div><p className="font-semibold">{m.l}</p><p className="text-xs text-muted-foreground">{m.h}</p></div>
                  </label>
                ))}
              </RadioGroup>
              <p className="mt-2 text-[11px] text-muted-foreground">Payment integration coming soon — your order will be marked as "Pending Payment" and our team will contact you.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <Row label="Subtotal" value={inr(subtotal)} />
              <Row label="GST (3%)" value={inr(gst)} />
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span><span className="font-serif text-burgundy">{inr(total)}</span>
              </div>
            </div>

            <Button className="h-12 w-full bg-burgundy hover:bg-burgundy/90" disabled={placeOrder.isPending} onClick={() => placeOrder.mutate()}>
              {placeOrder.isPending ? "Placing…" : `Place Order · ${inr(total)}`}
            </Button>
          </div>
        )}

        {step === "confirm" && orderId && (
          <div className="mt-10 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-burgundy" />
            <h2 className="mt-4 font-serif text-2xl font-bold">Order Placed!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Order number</p>
            <p className="font-serif text-xl font-semibold gold-text">{orderNo}</p>
            <p className="mt-4 text-sm text-muted-foreground">We'll send you updates as your order progresses.</p>
            <div className="mt-8 flex flex-col gap-2">
              <Button asChild className="bg-burgundy hover:bg-burgundy/90"><Link to="/orders/$id" params={{ id: orderId }}>View Order</Link></Button>
              <Button asChild variant="outline"><Link to="/catalogue">Continue Shopping</Link></Button>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function Steps({ step }: { step: Step }) {
  const steps = [
    { k: "address", l: "Address" },
    { k: "payment", l: "Payment" },
    { k: "confirm", l: "Done" },
  ];
  const idx = steps.findIndex((s) => s.k === step);
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.k} className="flex items-center gap-2">
          <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${i <= idx ? "bg-burgundy text-ivory" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
          <span className={`text-xs ${i === idx ? "font-semibold" : "text-muted-foreground"}`}>{s.l}</span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{label}</span><span className="text-foreground">{value}</span></div>;
}
