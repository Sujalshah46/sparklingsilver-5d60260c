import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";

import { placeOrder as placeOrderFn } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: pageTitle("Checkout") }] }),
  component: Checkout,
});

function Checkout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [placed, setPlaced] = useState<{ id: string; order_no: string } | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const { data: items, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, size, product:products(*)")
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-address", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("delivery_address")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const defaultAddress = (profile?.delivery_address ?? "").trim();

  useEffect(() => {
    if (useDefault) setAddress(defaultAddress);
  }, [useDefault, defaultAddress]);

  const totalPieces = (items ?? []).reduce((n, it) => n + it.quantity, 0);
  const totalGrossWt = (items ?? []).reduce(
    (s, it) => s + Number(it.product?.gross_weight ?? 0) * it.quantity,
    0,
  );

  const placeOrderRpc = useServerFn(placeOrderFn);
  const placeOrder = useMutation({
    mutationFn: async () =>
      placeOrderRpc({
        data: {
          customer_address: address.trim(),
          customer_notes: notes.trim() || null,
        },
      }),
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
    const whatsAppHref = whatsappUrl(`Hello Sparkling Silver, I just placed order ${placed.order_no}. Please confirm.`);
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
              <p>Our team will review your order and contact you on WhatsApp to confirm the details & delivery. You'll get updates in-app at each stage.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="bg-burgundy hover:bg-burgundy/90">
              <Link to="/orders/$id" params={{ id: placed.id }}>View Order Details</Link>
            </Button>
            <Button asChild variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
              <a
                href={whatsAppHref}
                target={WHATSAPP_LINK_TARGET}
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  openWhatsAppUrl(whatsAppHref);
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4" /> Notify us on WhatsApp
              </a>
            </Button>
            <Button asChild variant="ghost">
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

  if (cartLoading || !items) {
    return (
      <MobileShell title="Checkout">
        <p className="py-20 text-center text-muted-foreground">Loading…</p>
      </MobileShell>
    );
  }

  if (items.length === 0) {
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

  const valid = address.trim().length > 0;

  return (
    <MobileShell title="Place Order">
      <form
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast.error("Please enter a delivery address");
          placeOrder.mutate();
        }}
      >
        <div className="rounded-xl border border-burgundy/20 bg-burgundy/5 p-3 text-xs text-burgundy">
          Our team will review your order and contact you on WhatsApp to confirm the details & delivery.
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="addr">Delivery address *</Label>
            <Textarea
              id="addr"
              required
              maxLength={1000}
              rows={4}
              readOnly={useDefault}
              placeholder={useDefault ? "" : "Enter a new delivery address"}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={useDefault ? "bg-muted/50" : undefined}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={useDefault}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setUseDefault(on);
                  if (on) setAddress(defaultAddress);
                  else setAddress("");
                }}
                disabled={!defaultAddress}
              />
              <span>
                Use my default delivery address
                {!defaultAddress && " (not set in profile)"}
              </span>
            </label>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              maxLength={1000}
              rows={2}
              placeholder="Anything we should know about your order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Items" value={String(items.length)} />
          <Row label="Total pieces" value={String(totalPieces)} />
          <Row label="Total gross weight" value={`${totalGrossWt.toFixed(3)} g`} />
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
