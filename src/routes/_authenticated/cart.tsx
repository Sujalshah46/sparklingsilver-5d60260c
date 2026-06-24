import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { resolveProductImage } from "@/lib/product-images";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({ meta: [{ title: "Cart — Sparkling Jewellers" }] }),
  component: CartPage,
});

function CartPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
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

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity < 1) return supabase.from("cart_items").delete().eq("id", id);
      return supabase.from("cart_items").update({ quantity }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("cart_items").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); },
  });

  const items = data ?? [];
  const subtotal = items.reduce((s, it) => s + Number(it.product?.price ?? 0) * it.quantity, 0);
  const gst = subtotal * 0.03;
  const total = subtotal + gst;

  return (
    <MobileShell title="Cart">
      <div className="p-4">
        {isLoading ? (
          <p className="py-20 text-center text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-serif text-xl">Your cart is empty</h2>
            <p className="mt-1 text-sm text-muted-foreground">Discover designs you'll love.</p>
            <Button asChild className="mt-6"><Link to="/catalogue">Start Shopping</Link></Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  <img src={resolveProductImage(it.product?.image_url)} alt={it.product?.name} width={96} height={96} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="line-clamp-1 font-serif text-sm font-semibold">{it.product?.name}</p>
                      <p className="text-[11px] text-muted-foreground">{it.product?.purity} · {it.product?.net_weight}g{it.size ? ` · Size ${it.size}` : ""}</p>
                      <p className="mt-1 font-serif font-semibold text-burgundy">{inr(it.product?.price ?? 0)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button className="grid h-8 w-8 place-items-center" onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity - 1 })}><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-7 text-center text-sm font-semibold">{it.quantity}</span>
                        <button className="grid h-8 w-8 place-items-center" onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <button onClick={() => remove.mutate(it.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <Input placeholder="Promo code (optional)" />
              <div className="mt-4 space-y-1 text-sm">
                <Row label="Subtotal" value={inr(subtotal)} />
                <Row label="GST (3%)" value={inr(gst)} />
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span><span className="font-serif text-burgundy">{inr(total)}</span>
                </div>
              </div>
            </div>

            <Button asChild className="mt-4 h-12 w-full bg-burgundy text-ivory hover:bg-burgundy/90">
              <Link to="/checkout">Proceed to Checkout</Link>
            </Button>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground"><span>{label}</span><span className="text-foreground">{value}</span></div>
  );
}
