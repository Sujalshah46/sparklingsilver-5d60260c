import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveProductImage, productThumbUrl } from "@/lib/product-images";
import { toast } from "sonner";

export type CatalogueCardData = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  purity: string;
  metal?: string | null;
  gross_weight: number | string;
  
  image_url: string | null;
};

export function CatalogueCard({
  p, compact = false, showCart = true,
}: { p: CatalogueCardData; compact?: boolean; showCart?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);

  const wish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: p.id });
    },
    onSuccess: () => { toast.success("Added to wishlist"); qc.invalidateQueries({ queryKey: ["wishlist"] }); },
    onError: (e: Error) => {
      if (e.message === "auth") navigate({ to: "/auth", search: { redirect: "/catalogue" } });
      else toast.message("Already in wishlist");
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const { error } = await supabase
        .from("cart_items")
        .upsert({ user_id: user.id, product_id: p.id, quantity: qty, size: null }, { onConflict: "user_id,product_id,size" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to cart");
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-weight"] });
    },
    onError: (e: Error) => {
      if (e.message === "auth") navigate({ to: "/auth", search: { redirect: "/catalogue" } });
      else toast.error("Could not add to cart");
    },
  });

  return (
    <div className="flex flex-col overflow-hidden border border-[#EEE] bg-white">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block">
        <button
          aria-label="Save to wishlist"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); wish.mutate(); }}
          className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-[#DDD] bg-white/95 text-[#555] hover:text-teal"
        >
          <Heart className="h-3.5 w-3.5" />
        </button>
        <div className="ruler-frame aspect-square w-full">
          <img
            src={resolveProductImage(p.image_url)}
            alt={p.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-3"
            style={{ paddingLeft: 14, paddingBottom: 14 }}
          />
        </div>
      </Link>
      <div className={`space-y-0.5 px-2 py-2 text-center ${compact ? "text-[10.5px]" : "text-[11px]"} text-[#555]`}>
        <p className="text-[12.5px] font-bold tracking-wide text-[#1A1A1A]">{p.sku}</p>
        <p><span className="font-semibold text-[#333]">Gross Wt:</span> {Number(p.gross_weight).toFixed(3)}</p>
        
        <p><span className="font-semibold text-[#333]">Silver Purity:</span> {p.purity}</p>
      </div>
      {showCart && (
        <>
          <div className="flex items-stretch justify-center gap-1 border-t border-[#EEE] px-2 py-1.5">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-7 w-7 place-items-center border border-[#CCC] text-[#333] hover:bg-[#F4F4F4]" aria-label="Decrease">
              <Minus className="h-3 w-3" />
            </button>
            <input
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              inputMode="numeric"
              className="h-7 w-12 border border-[#CCC] text-center text-[12px] text-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button onClick={() => setQty((q) => q + 1)} className="grid h-7 w-7 place-items-center border border-[#CCC] text-[#333] hover:bg-[#F4F4F4]" aria-label="Increase">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="h-9 w-full bg-teal text-[12px] font-bold uppercase tracking-wider text-white hover:bg-teal-dark disabled:opacity-60"
          >
            Add to Cart
          </button>
        </>
      )}
    </div>
  );
}
