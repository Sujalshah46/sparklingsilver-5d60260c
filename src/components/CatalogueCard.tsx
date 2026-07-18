import { useState, useMemo } from "react";
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
  p, compact = false, showCart = true, priority = false,
}: { p: CatalogueCardData; compact?: boolean; showCart?: boolean; priority?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  const rawSrc = resolveProductImage(p.image_url);
  // Responsive thumbnails: small tile for 2-col mobile, larger for wider screens.
  // Only rewrite for Supabase render URLs; local bundled assets pass through untouched.
  const { src, srcSet, detailPrefetchUrl, lqip } = useMemo(() => {
    const isRenderable = typeof rawSrc === "string" && rawSrc.includes("/storage/v1/");
    if (!isRenderable) return { src: rawSrc, srcSet: undefined as string | undefined, detailPrefetchUrl: undefined as string | undefined, lqip: undefined as string | undefined };
    const base = compact ? 220 : 300;
    const src = productThumbUrl(rawSrc, { width: base, quality: 55 });
    const w2x = productThumbUrl(rawSrc, { width: base * 2, quality: 55 });
    const detailPrefetchUrl = productThumbUrl(rawSrc, { width: 800, quality: 70 });
    const lqip = productLqipUrl(rawSrc);
    return { src, srcSet: `${src} 1x, ${w2x} 2x`, detailPrefetchUrl, lqip };
  }, [rawSrc, compact]);

  const prefetchDetail = () => {
    if (!detailPrefetchUrl || typeof window === "undefined") return;
    const img = new Image();
    img.decoding = "async";
    img.src = detailPrefetchUrl;
  };

  return (
    <div className="group flex flex-col overflow-hidden border border-[#EEE] bg-white lg:transition-all lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-lg lg:hover:border-teal/40">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block" onPointerEnter={prefetchDetail} onTouchStart={prefetchDetail}>
        <button
          aria-label="Save to wishlist"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); wish.mutate(); }}
          className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-[#DDD] bg-white/95 text-[#555] hover:text-teal"
        >
          <Heart className="h-3.5 w-3.5" />
        </button>
        <div className="ruler-frame aspect-square w-full bg-[#F5F5F3]">
          {lqip && !imgLoaded && (
            <img
              aria-hidden
              src={lqip}
              alt=""
              className="absolute inset-0 h-full w-full object-contain p-3"
              style={{ paddingLeft: 14, paddingBottom: 14, filter: "blur(12px)", transform: "scale(1.05)" }}
            />
          )}
          {!lqip && !imgLoaded && (
            <div aria-hidden className="absolute inset-0 bg-[#F0EFEA]" />
          )}
          <img
            src={src}
            srcSet={srcSet}
            sizes={compact ? "(min-width:1280px) 180px, (min-width:768px) 220px, 45vw" : "(min-width:1280px) 260px, (min-width:768px) 300px, 48vw"}
            alt={p.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? { fetchPriority: "high" as const } : { fetchPriority: "low" as const })}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            className="absolute inset-0 h-full w-full object-contain p-3 lg:transition-transform lg:duration-300 lg:group-hover:scale-[1.04]"
            style={{ paddingLeft: 14, paddingBottom: 14, opacity: imgLoaded ? 1 : 0, transition: "opacity 150ms ease-out" }}
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
