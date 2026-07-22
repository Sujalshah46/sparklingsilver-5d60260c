import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Heart, Share2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Sparkling Silver" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist_items")
        .select("id, product:products(*)")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("wishlist_items").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["wishlist"] }); },
  });

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { await navigator.share({ title: "My Sparkling Wishlist", url }); }
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };

  const items = data ?? [];

  return (
    <MobileShell title="Wishlist">
      <div className="p-4">
        {items.length === 0 ? (
          <div className="py-20 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-serif text-xl">Your wishlist is empty</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any piece you love.</p>
            <Button asChild className="mt-6"><Link to="/catalogue">Browse Designs</Link></Button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{items.length} saved {items.length === 1 ? "item" : "items"}</p>
              <Button variant="outline" size="sm" onClick={share}><Share2 className="mr-1.5 h-3.5 w-3.5" />Share</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map((it) => (
                <div key={it.id} className="relative">
                  <ProductCard p={it.product as unknown as ProductCardData} />
                  <button
                    onClick={() => remove.mutate(it.id)}
                    className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-background shadow"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
