import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveProductImage, productThumbUrl, productVariantUrl, type ImageVariants } from "@/lib/product-images";
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
  image_variants?: ImageVariants;
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
  // Prefer pre-resized WebP variants (uploaded via backfill). Fall back to
  // on-the-fly transform URLs for legacy rows without variants.
  const { src, srcSet, detailPrefetchUrl } = useMemo(() => {
    const variantThumb = productVariantUrl(p.image_variants, "thumb");
    const variantCard = productVariantUrl(p.image_variants, "card");
    const variantDetail = productVariantUrl(p.image_variants, "detail");
    if (variantThumb && variantCard) {
      // Include the "detail" variant in the srcset so high-DPR desktops
      // (2-col grid on laptops = ~500-600 CSS px tile at dpr=2 ≈
      // 1000-1200 device px) don't get an upscaled blurry card render.
      const parts = [`${variantThumb} 300w`, `${variantCard} 600w`];
      if (variantDetail) parts.push(`${variantDetail} 1200w`);
      return {
        src: variantCard,
        srcSet: parts.join(", "),
        detailPrefetchUrl: variantDetail ?? variantCard,
      };
    }
    const isRenderable = typeof rawSrc === "string" && rawSrc.includes("/storage/v1/");
    if (!isRenderable) return { src: rawSrc, srcSet: undefined as string | undefined, detailPrefetchUrl: undefined as string | undefined };
    const base = compact ? 220 : 400;
    const w1 = productThumbUrl(rawSrc, { width: base, quality: 60 });
    const w2 = productThumbUrl(rawSrc, { width: base * 2, quality: 60 });
    const w3w = Math.min(base * 3, 1200);
    const w3 = productThumbUrl(rawSrc, { width: w3w, quality: 65 });
    const detailPrefetchUrl = productThumbUrl(rawSrc, { width: 1200, quality: 70 });
    return {
      src: w1,
      srcSet: `${w1} ${base}w, ${w2} ${base * 2}w, ${w3} ${w3w}w`,
      detailPrefetchUrl,
    };
  }, [rawSrc, compact, p.image_variants]);


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
        <div className="ruler-frame relative aspect-square w-full bg-[#F5F5F3]">
          {!imgLoaded && <span aria-hidden className="img-skeleton absolute inset-0" />}
          <img
            src={src}
            srcSet={srcSet}
            sizes={compact ? "(min-width:1280px) 200px, (min-width:768px) 240px, 33vw" : "(min-width:1536px) 380px, (min-width:1280px) 340px, (min-width:1024px) 480px, (min-width:768px) 340px, 50vw"}
            alt={p.name}
            width={600}
            height={600}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            {...(priority ? { fetchPriority: "high" as const } : { fetchPriority: "low" as const })}
            className={`absolute inset-0 h-full w-full object-contain p-3 transition-opacity duration-300 lg:group-hover:scale-[1.04] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            style={{ paddingLeft: 14, paddingBottom: 14 }}
          />
        </div>

      </Link>
      <div className={`space-y-0.5 px-2 py-2 text-center ${compact ? "text-[10.5px]" : "text-[11px]"} text-[#555]`}>
        <p className="text-[12.5px] font-bold tracking-wide text-[#1A1A1A]">{p.sku}</p>
        <p><span className="font-semibold text-[#333]">Gross Wt:</span> {Number(p.gross_weight).toFixed(3)}</p>
        
        <p><span className="font-semibold text-[#333]">Silver Purity:</span> {p.purity}</p>
      </div>
      {showCart && !user && (
        <Link to="/auth" search={{ redirect: "/catalogue" }} className="block border-t border-[#EEE] px-2 py-2 text-center text-[11px] font-semibold text-burgundy underline underline-offset-2">
          Login to view wholesale pricing
        </Link>
      )}
      {showCart && user && (
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
