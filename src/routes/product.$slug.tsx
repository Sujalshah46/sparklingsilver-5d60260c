import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { resolveProductImage } from "@/lib/product-images";
import { inr, grams } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, MessageCircle, ShieldCheck, Award, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";


const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: product } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
      if (!product) return null;
      const { data: similar } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", product.category_id!)
        .neq("id", product.id)
        .limit(4);
      return { product, similar: (similar ?? []) as ProductCardData[] };
    },
  });

export const Route = createFileRoute("/product/$slug")({
  head: ({ params, loaderData }) => {
    const p = (loaderData as { product?: { name: string; sku: string; description: string | null; price: number | string; image_url: string | null; in_stock: boolean | null } } | undefined)?.product;
    const title = p ? `${p.name} — Sparkling Silver` : "Jewellery — Sparkling Silver";
    const rawDesc = (p?.description ?? "").trim();
    const desc = rawDesc
      ? rawDesc.slice(0, 158)
      : `Shop ${p?.name ?? "premium jewellery"} at Sparkling Silver. BIS hallmarked, transparent pricing.`;
    const url = `https://sparkling-jewellers-llp.lovable.app/product/${params.slug}`;
    const img = p?.image_url
      ? (p.image_url.startsWith("http") ? p.image_url : `https://sparkling-jewellers-llp.lovable.app${p.image_url}`)
      : "https://sparkling-jewellers-llp.lovable.app/og-home.jpg";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: img },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: img },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.name,
                sku: p.sku,
                image: img,
                description: rawDesc || p.name,
                brand: { "@type": "Brand", name: "Sparkling Silver LLP" },
                offers: {
                  "@type": "Offer",
                  url,
                  priceCurrency: "INR",
                  price: String(p.price),
                  availability: p.in_stock
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                },
              }),
            },
          ]
        : [],
    };
  },
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const product = data!.product;
  const [size, setSize] = useState<string | null>(product.sizes?.[0] ?? null);

  const goldValue = Number(product.net_weight) * 6830; // 22K reference
  const makingCharge = (goldValue * Number(product.making_charge_pct)) / 100;
  const gst = (goldValue + makingCharge) * 0.03;

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname } }); throw new Error("auth"); }
      const { error } = await supabase.from("cart_items").upsert(
        { user_id: user.id, product_id: product.id, quantity: 1, size },
        { onConflict: "user_id,product_id,size" }
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added to cart"); qc.invalidateQueries({ queryKey: ["cart-count"] }); qc.invalidateQueries({ queryKey: ["cart"] }); },
    onError: (e: Error) => { if (e.message !== "auth") toast.error("Could not add to cart"); },
  });

  const addToWishlist = useMutation({
    mutationFn: async () => {
      if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname } }); throw new Error("auth"); }
      await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: product.id });
    },
    onSuccess: () => toast.success("Saved to wishlist"),
    onError: (e: Error) => { if (e.message !== "auth") toast.message("Already in wishlist"); },
  });

  return (
    <MobileShell>
      <div className="aspect-square w-full overflow-hidden bg-secondary">
        <img
          src={resolveProductImage(product.image_url)}
          alt={product.name}
          width={1024}
          height={1024}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="space-y-5 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">SKU {product.sku}</p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-foreground">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-gold/40 text-foreground">{product.purity} {product.metal}</Badge>
            {product.stone_type && <Badge variant="outline">{product.stone_type}</Badge>}
            {product.occasion && <Badge variant="outline">{product.occasion}</Badge>}
          </div>
          <p className="mt-4 font-serif text-3xl font-semibold text-burgundy">{inr(product.price)}</p>
          <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3 text-center text-xs">
          <div><p className="text-muted-foreground">Gross Wt</p><p className="mt-0.5 font-semibold">{grams(product.gross_weight)}</p></div>
          <div><p className="text-muted-foreground">Net Wt</p><p className="mt-0.5 font-semibold">{grams(product.net_weight)}</p></div>
          <div><p className="text-muted-foreground">Stone Wt</p><p className="mt-0.5 font-semibold">{grams(product.stone_weight ?? 0)}</p></div>
        </div>

        {product.sizes && product.sizes.length > 0 && (
          <div>
            <p className="text-sm font-semibold">Size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${size === s ? "border-burgundy bg-burgundy text-ivory" : "border-border bg-card text-foreground hover:border-gold"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold">Pricing Breakdown</p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Gold value (ref)</span><span>{inr(goldValue)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Making charges ({product.making_charge_pct}%)</span><span>{inr(makingCharge)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST (3%)</span><span>{inr(gst)}</span></div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span className="text-burgundy">{inr(product.price)}</span></div>
          </div>
        </div>

        {product.description && (
          <div>
            <p className="font-semibold">Description</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <div className="rounded-lg border border-border bg-card p-3"><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-gold" />BIS Hallmarked</div>
          <div className="rounded-lg border border-border bg-card p-3"><Award className="mx-auto mb-1 h-4 w-4 text-gold" />Certified</div>
          <div className="rounded-lg border border-border bg-card p-3"><Truck className="mx-auto mb-1 h-4 w-4 text-gold" />Free Shipping</div>
        </div>

        {data!.similar.length > 0 && (
          <div className="pt-2">
            <h2 className="font-serif text-lg font-semibold">You may also like</h2>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {data!.similar.map((p) => (
                <div key={p.id} className="w-44 shrink-0"><ProductCard p={p} /></div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Save to wishlist" className="h-12 w-12 shrink-0" onClick={() => addToWishlist.mutate()}>
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="outline" className="h-12 flex-1" onClick={() => addToCart.mutate()}>
            <ShoppingBag className="mr-1.5 h-4 w-4" /> Add to Cart
          </Button>
          <Button asChild className="h-12 flex-1 bg-burgundy text-ivory hover:bg-burgundy/90">
            <a href={`https://wa.me/919999999999?text=${encodeURIComponent(`Hi, I'm interested in ${product.name} (${product.sku})`)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Enquire
            </a>
          </Button>
        </div>
      </div>

      <div className="h-24" />
    </MobileShell>
  );
}
