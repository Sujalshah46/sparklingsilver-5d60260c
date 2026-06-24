import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { resolveProductImage } from "@/lib/product-images";
import { inr, grams } from "@/lib/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: number | string;
  net_weight: number | string;
  purity: string;
  image_url: string;
  is_bestseller?: boolean | null;
  is_new?: boolean | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const wishlist = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: p.id });
    },
    onSuccess: () => {
      toast.success("Added to wishlist");
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (e: Error) => {
      if (e.message === "auth") toast.error("Please sign in to save items");
      else toast.error("Already in wishlist");
    },
  });

  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      className="group block overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <img
          src={resolveProductImage(p.image_url)}
          alt={p.name}
          loading="lazy"
          width={512}
          height={512}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {p.is_bestseller && (
          <span className="absolute left-2 top-2 rounded-full bg-burgundy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ivory">
            Bestseller
          </span>
        )}
        {p.is_new && !p.is_bestseller && (
          <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal">
            New
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            wishlist.mutate();
          }}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 backdrop-blur transition hover:bg-background"
          aria-label="Save to wishlist"
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 font-serif text-sm font-semibold text-foreground">{p.name}</h3>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-medium text-foreground">{p.purity}</span>
          <span>·</span>
          <span>{grams(p.net_weight)}</span>
        </div>
        <p className="pt-1 font-serif text-base font-semibold text-burgundy">{inr(p.price)}</p>
      </div>
    </Link>
  );
}
