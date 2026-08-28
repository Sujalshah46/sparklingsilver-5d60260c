import { pageTitle, pageDescription, descriptionTags, jsonLdScript, productSchema, breadcrumbSchema } from "@/lib/seo";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { resolveProductImage, productThumbUrl } from "@/lib/product-images";
import { ProductGallery } from "@/components/ProductImageZoom";
import { useSignedImages } from "@/lib/useSignedImages";
import { grams } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, MessageCircle, ShieldCheck, Award, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApproval } from "@/hooks/use-approval";
import { toast } from "sonner";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl, HIDDEN_CATEGORY_NAMES_LC } from "@/lib/site";


const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: product } = await supabase.from("products").select("id, sku, name, slug, description, category_id, subcategory_id, collection_id, metal, purity, gross_weight, net_weight, stone_weight, stone_type, occasion, sizes, moq, image_url, images, image_variants, is_new, is_bestseller, is_trending, in_stock, stock_quantity, created_at, categories(name)").eq("slug", slug).maybeSingle();
      if (!product) return null;
      const catName = ((product as any).categories?.name ?? "").toLowerCase();
      if (HIDDEN_CATEGORY_NAMES_LC.includes(catName)) return null;
      const similarQuery = supabase
        .from("products")
        .select("id, sku, name, slug, description, category_id, subcategory_id, collection_id, metal, purity, gross_weight, net_weight, stone_weight, stone_type, occasion, sizes, moq, image_url, images, image_variants, is_new, is_bestseller, is_trending, in_stock, stock_quantity, created_at")
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
  // RLS hides non-featured designs from anonymous/pending viewers; SSR has no
  // session, so the lookup must run in the browser with the viewer's token.
  ssr: false,
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
            jsonLdScript([
              productSchema({
                name: p.name,
                sku: p.sku,
                image: img,
                description: rawDesc || p.name,
                url,
                availability: p.in_stock === false ? "OutOfStock" : "InStock",
              }),
              breadcrumbSchema([
                { name: "Home", url: "https://sparklingsilver.in/" },
                { name: "Catalogue", url: "https://sparklingsilver.in/catalogue" },
                { name: p.name, url },
              ]),
            ]),
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
  const { isApproved } = useApproval();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const product = data!.product;
  const [size, setSize] = useState<string | null>(product.sizes?.[0] ?? null);
  const whatsAppHref = whatsappUrl(`Hi, I'm interested in ${product.name} (${product.sku})`);

  const { productImages, thumbImages } = useMemo(() => {
    const variants = product.image_variants as
      | { detail?: string; card?: string; thumb?: string; gallery?: string[] }
      | null;
    const gallery = (variants?.gallery ?? []).filter(Boolean) as string[];
    const full = [
      variants?.detail ?? variants?.card ?? variants?.thumb ?? resolveProductImage(product.image_url),
      ...gallery,
    ].filter(Boolean) as string[];
    // 64px strip tiles never need the 1200w render.
    const thumbs = [
      variants?.thumb ?? productThumbUrl(full[0], { width: 200, quality: 55 }),
      ...gallery.map((g) => productThumbUrl(g, { width: 200, quality: 55 })),
    ];
    return { productImages: full, thumbImages: thumbs };
  }, [product]);

  // Short-lived (1 h) signed URLs so scraped links stop working within the hour.
  const { resolve: signImage } = useSignedImages([...productImages, ...thumbImages]);
  const signedImages = useMemo(() => productImages.map((u) => signImage(u)), [productImages, signImage]);
  const signedThumbs = useMemo(() => thumbImages.map((u) => signImage(u)), [thumbImages, signImage]);


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
      <ProductGallery images={signedImages} thumbs={signedThumbs} alt={product.name} className="w-full" />


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
          {user && isApproved ? (
            <>
              <Button variant="outline" size="icon" aria-label="Save to wishlist" className="h-12 w-12 shrink-0" onClick={() => addToWishlist.mutate()}>
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="outline" className="h-12 flex-1" onClick={() => addToCart.mutate()}>
                <ShoppingBag className="mr-1.5 h-4 w-4" /> Add to Cart
              </Button>
            </>
          ) : user ? (
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-[12px] leading-snug text-muted-foreground">
                Your account is awaiting approval. Wholesale rates and ordering unlock once approved.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-[12px] leading-snug text-muted-foreground">
                Login to view wholesale pricing and place orders
              </p>
              <Link
                to="/auth"
                search={{ redirect: `/product/${slug}` }}
                className="mt-0.5 text-[13px] font-semibold text-burgundy underline underline-offset-2"
              >
                Login
              </Link>
            </div>
          )}
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
