import { pageTitle } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { resolveProductImage, productThumbUrl, productVariantUrl, type ImageVariants } from "@/lib/product-images";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";


const REMARK_MAX_LENGTH = 500;

/**
 * Cart rows render 96px thumbnails, so never ship the full-resolution original
 * (~950 KB). Prefer the pre-generated `thumb` WebP variant (~9 KB); otherwise
 * fall back to an on-the-fly Storage transform at 2x the slot size.
 */
function cartThumbSrc(
  imageUrl: string | null | undefined,
  variants: ImageVariants,
): string {
  const variant = productVariantUrl(variants, "thumb");
  if (variant) return resolveProductImage(variant);
  const resolved = resolveProductImage(imageUrl);
  return productThumbUrl(resolved, { width: 192, height: 192, quality: 70 });
}

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({ meta: [{ title: pageTitle("Cart") }] }),
  component: CartPage,
});

function CartPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, size, remark, product:products(id, slug, name, sku, purity, gross_weight, image_url, image_variants)")
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const res = quantity < 1
        ? await supabase.from("cart_items").delete().eq("id", id)
        : await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
    },
    onError: (err: Error) => { toast.error(err.message); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); },
  });

  const updateRemark = useMutation({
    mutationFn: async ({ id, remark }: { id: string; remark: string }) => {
      const trimmed = remark.trim();
      if (trimmed.length > REMARK_MAX_LENGTH) {
        throw new Error(`Remark must be ${REMARK_MAX_LENGTH} characters or fewer`);
      }
      const { error } = await supabase.from("cart_items").update({ remark: trimmed ? trimmed : null }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onError: (err: Error) => { toast.error(err.message); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onError: (err: Error) => { toast.error(err.message); },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["cart"] }); qc.invalidateQueries({ queryKey: ["cart-count"] }); },
  });

  const items = data ?? [];
  const totalPieces = items.reduce((n, it) => n + it.quantity, 0);
  const totalGrossWt = items.reduce(
    (s, it) => s + Number(it.product?.gross_weight ?? 0) * it.quantity,
    0,
  );

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
                <div key={it.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex gap-3">
                    {it.product?.slug ? (
                      <Link
                        to="/product/$slug"
                        params={{ slug: it.product.slug }}
                        aria-label={`View ${it.product.name}`}
                        className="shrink-0"
                      >
                        <img src={resolveProductImage(it.product.image_url)} alt={it.product.name} width={96} height={96} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                      </Link>
                    ) : (
                      <img src={resolveProductImage(it.product?.image_url)} alt={it.product?.name} width={96} height={96} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        {it.product?.slug ? (
                          <Link
                            to="/product/$slug"
                            params={{ slug: it.product.slug }}
                            className="block py-3 no-underline text-foreground"
                          >
                            <span className="line-clamp-1 font-serif text-sm font-semibold">{it.product.name}</span>
                          </Link>
                        ) : (
                          <p className="line-clamp-1 font-serif text-sm font-semibold">{it.product?.name}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{it.product?.purity}{it.size ? ` · Size ${it.size}` : ""}</p>
                        <p className="mt-1 text-[11px] text-[#555]"><span className="font-semibold text-[#333]">Gross Wt:</span> {Number(it.product?.gross_weight ?? 0).toFixed(3)} g</p>
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
                  <RemarkField
                    initial={it.remark ?? ""}
                    onSave={(remark) => updateRemark.mutate({ id: it.id, remark })}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="space-y-1 text-sm">
                <Row label="Total pieces" value={String(totalPieces)} />
                <Row label="Total gross weight" value={`${totalGrossWt.toFixed(3)} g`} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Our team will confirm your order details on WhatsApp after checkout.
              </p>
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

export function RemarkField({ initial, onSave }: { initial: string; onSave: (remark: string) => void }) {
  const [value, setValue] = useState(initial);
  const focusedRef = useRef(false);
  useEffect(() => {
    // Only sync from server when the user isn't actively editing, otherwise
    // a background refetch would wipe their in-progress typing.
    if (!focusedRef.current) setValue(initial);
  }, [initial]);
  const over = value.length > REMARK_MAX_LENGTH;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Remark (optional)
        </label>
        <span className={`text-[10px] ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {value.length}/{REMARK_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        value={value}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => setValue(e.target.value.slice(0, REMARK_MAX_LENGTH))}
        onBlur={() => {
          focusedRef.current = false;
          const next = value.trim();
          if (!over && next !== initial.trim()) onSave(next);
        }}

        placeholder="Add a note for this product (size, design tweak, etc.)"
        rows={2}
        maxLength={REMARK_MAX_LENGTH}
        aria-invalid={over}
        className="min-h-[56px] resize-y text-sm"
      />
    </div>
  );
}
