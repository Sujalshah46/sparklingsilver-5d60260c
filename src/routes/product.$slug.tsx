import { pageTitle, pageDescription, descriptionTags, jsonLdScript, productSchema, breadcrumbSchema } from "@/lib/seo";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { resolveProductImage, productThumbUrl } from "@/lib/product-images";
import { grams } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, MessageCircle, ShieldCheck, Award, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl, HIDDEN_CATEGORY_NAMES_LC } from "@/lib/site";


const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: product } = await supabase.from("products").select("*, categories(name)").eq("slug", slug).maybeSingle();
      if (!product) return null;
      const catName = ((product as any).categories?.name ?? "").toLowerCase();
      if (HIDDEN_CATEGORY_NAMES_LC.includes(catName)) return null;
      const similarQuery = supabase
        .from("products")
        .select("*")
        .eq("category_id", product.category_id!)
        .neq("id", product.id)
        .limit(12);

      const { data: similar } = product.subcategory_id
        ? await similarQuery.eq("subcategory_id", product.subcategory_id)
        : await similarQuery.is("subcategory_id", null);
      return { product, similar: (similar ?? []) as ProductCardData[] };
    },
  });

export const Route = createFileRoute("/product/$slug")({
  head: ({ params, loaderData }) => {
    const p = (loaderData as { product?: { name: string; sku: string; description: string | null; image_url: string | null; in_stock: boolean | null } } | undefined)?.product;
    const title = pageTitle(p ? p.name : "Jewellery");
    const rawDesc = (p?.description ?? "").trim();
    const desc = pageDescription(
      rawDesc ||
        `${p?.name ?? "Premium 925 sterling silver jewellery"} at Sparkling Silver — BIS hallmarked wholesale designs.`,
    );
    const url = `https://sparklingsilver.in/product/${params.slug}`;
    const img = p?.image_url
      ? (p.image_url.startsWith("http") ? p.image_url : `https://sparklingsilver.in${p.image_url}`)
      : "https://sparklingsilver.in/og-home.jpg";
    return {
      meta: [
        { title },
        ...descriptionTags(desc),
        { property: "og:title", content: title },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: img },
        { name: "twitter:title", content: title },
        { name: "twitter:image", content: img },
      ],
      links: [
        { rel: "canonical", href: url },
        ...(p?.image_url && p.image_url.includes("/storage/v1/")
          ? [{
              rel: "preload",
              as: "image",
              href: productThumbUrl(p.image_url, { width: 800, quality: 70 }),
              imagesrcset: `${productThumbUrl(p.image_url, { width: 800, quality: 70 })} 800w, ${productThumbUrl(p.image_url, { width: 1200, quality: 70 })} 1200w, ${productThumbUrl(p.image_url, { width: 1600, quality: 72 })} 1600w`,
              imagesizes: "(min-width:768px) 640px, 100vw",
              fetchpriority: "high",
            } as any]
          : []),
      ],
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
                brand: { "@type": "Brand", name: "Sparkling Silver" },
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
  const whatsAppHref = whatsappUrl(`Hi, I'm interested in ${product.name} (${product.sku})`);

  const rawImg = resolveProductImage(product.image_url);
  const isRenderable = typeof rawImg === "string" && rawImg.includes("/storage/v1/");
  const { imgSrc, imgSrcSet, lqipSrc } = useMemo(() => {
    if (!isRenderable) return { imgSrc: rawImg, imgSrcSet: undefined as string | undefined, lqipSrc: rawImg };
    return {
      imgSrc: productThumbUrl(rawImg, { width: 800, quality: 70 }),
      imgSrcSet: `${productThumbUrl(rawImg, { width: 800, quality: 70 })} 800w, ${productThumbUrl(rawImg, { width: 1200, quality: 70 })} 1200w, ${productThumbUrl(rawImg, { width: 1600, quality: 72 })} 1600w`,
      // Same URL the grid tile just cached in the SW — paints instantly as LQIP.
      lqipSrc: productThumbUrl(rawImg, { width: 300, quality: 55 }),
    };
  }, [rawImg, isRenderable]);
  const [hiResLoaded, setHiResLoaded] = useState(false);


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
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {isRenderable && !hiResLoaded && (
          <img
            src={lqipSrc}
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ filter: "blur(6px)", transform: "scale(1.02)" }}
          />
        )}
        <img
          src={imgSrc}
          srcSet={imgSrcSet}
          sizes="(min-width:768px) 640px, 100vw"
          alt={product.name}
          width={1024}
          height={1024}
          decoding="async"
          fetchPriority="high"
          onLoad={() => setHiResLoaded(true)}
          className="relative h-full w-full object-contain"
        />

      </div>


      <div className="space-y-5 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">SKU {product.sku}</p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-foreground">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-gold/40 text-foreground">{(() => { const c = ((product as any).categories?.name ?? "").toLowerCase(); if (c.startsWith("antique")) return "925 Ultra Antique Jewellery"; if (c === "cz") return "925 Premium CZ Jewellery"; return `${product.purity} ${product.metal}`; })()}</Badge>
            {product.stone_type && <Badge variant="outline">{product.stone_type}</Badge>}
            {product.occasion && <Badge variant="outline">{product.occasion}</Badge>}
          </div>
        </div>

        <div className="relative flex items-center gap-4 border border-gold/40 bg-gradient-to-br from-card via-background to-card p-4 shadow-sm">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/50 bg-gradient-to-tr from-background to-card shadow-inner">
            <span className="font-serif text-[10px] font-bold tracking-widest text-burgundy">S925</span>
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Gross Weight</span>
            <span className="font-serif text-3xl font-semibold leading-none text-foreground">
              {grams(product.gross_weight)}
            </span>
          </div>
          <div className="absolute right-3 top-2 text-[9px] font-medium uppercase tracking-[0.2em] text-gold">Certified</div>
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

      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-border bg-background px-4 py-3" style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Save to wishlist" className="h-12 w-12 shrink-0" onClick={() => addToWishlist.mutate()}>
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="outline" className="h-12 flex-1" onClick={() => addToCart.mutate()}>
            <ShoppingBag className="mr-1.5 h-4 w-4" /> Add to Cart
          </Button>
          <Button asChild className="h-12 flex-1 bg-burgundy text-ivory hover:bg-burgundy/90">
            <a
              href={whatsAppHref}
              target={WHATSAPP_LINK_TARGET}
              rel="noopener noreferrer"
              onClick={(event) => {
                event.preventDefault();
                openWhatsAppUrl(whatsAppHref);
              }}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" /> Enquire
            </a>
          </Button>
        </div>
      </div>

      <div className="h-24" />
    </MobileShell>
  );
}
