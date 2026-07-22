import { pageTitle, pageDescription, descriptionTags } from "@/lib/seo";
import { useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ChevronLeft } from "lucide-react";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl, HIDDEN_CATEGORY_SLUGS } from "@/lib/site";
import { SUBCATEGORY_IMAGES, categoryPlaceholder, resolveProductImage } from "@/lib/product-images";

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
};

const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      if (HIDDEN_CATEGORY_SLUGS.includes(slug)) return null;
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (!cat) return null;
      const { data: links } = await supabase
        .from("category_subcategories")
        .select("subcategory_id")
        .eq("category_id", cat.id as string);
      const ids = (links ?? []).map((link) => link.subcategory_id);
      const { data: subcategories } = ids.length
        ? await supabase.from("subcategories").select("*").in("id", ids).order("sort_order")
        : { data: [] as Subcategory[] };

      // Per-subcategory product counts (scoped to this category) — single RPC.
      const { data: countRows } = await supabase.rpc("get_subcategory_product_counts", {
        _category_id: cat.id as string,
      });
      const counts: Record<string, number> = {};
      for (const row of (countRows ?? []) as Array<{ subcategory_id: string; product_count: number }>) {
        counts[row.subcategory_id] = Number(row.product_count) || 0;
      }

      const visibleSubcategories = (subcategories ?? []).filter((s) => (counts[s.id] ?? 0) > 0);


      return {
        category: cat,
        subcategories: visibleSubcategories as Subcategory[],
        subcategoryCounts: counts,
      };
    },
  });

export const Route = createFileRoute("/category/$slug/")({
  head: ({ params, loaderData }) => {
    const ld = loaderData as { category?: { name: string } } | undefined;
    const name = ld?.category?.name ?? params.slug;
    const title = pageTitle(name);
    const desc = pageDescription(
      `Browse our ${name.toLowerCase()} collection — premium 925 sterling silver designs with BIS hallmark.`,
    );
    const url = `https://sparklingsilver.in/category/${params.slug}`;
    return {
      meta: [
        { title },
        ...descriptionTags(desc),
        { property: "og:title", content: title },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(categoryQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <MobileShell title="Not found">
      <div className="py-20 text-center text-muted-foreground">Category not found.</div>
    </MobileShell>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(categoryQuery(slug));

  if (!data) return null;

  const whatsAppHref = whatsappUrl(`Hi, I'd like full access — viewing ${data.category.name}.`);

  return (
    <MobileShell title={data.category.name}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-2 py-2">
        <Link to="/catalogue" aria-label="Back" className="grid h-9 w-9 place-items-center text-[#333] hover:bg-[#F4F4F4]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-[16px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">
          {data.category.name} <span className="font-normal text-[#777]">({data.subcategories.length})</span>
        </h1>
      </div>

      {/* Subcategories */}
      {data.subcategories.length > 0 && (
        <section className="px-3 py-4">
          <div className="mb-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A]">Subcategories</p>
            <span className="mt-1 block h-px w-8 bg-teal" />
          </div>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-6">
            {data.subcategories.map((subcat, i) => (
              <SubcategoryTile
                key={subcat.id}
                categorySlug={slug}
                subcategory={subcat}
                count={data.subcategoryCounts?.[subcat.id] ?? 0}
                priority={i < 3}
              />
            ))}
          </div>
        </section>
      )}


      <div className="h-28" />
    </MobileShell>
  );
}


function SubcategoryTile({
  categorySlug,
  subcategory,
  count,
  priority = false,
}: {
  categorySlug: string;
  subcategory: Subcategory;
  count: number;
  priority?: boolean;
}) {
  const image = subcategory.image_url || SUBCATEGORY_IMAGES[subcategory.slug] || `subcat-${subcategory.slug}.jpg`;
  const [src, setSrc] = useState(() => resolveProductImage(image, categoryPlaceholder));

  return (
    <Link
      to="/category/$slug/$sub"
      params={{ slug: categorySlug, sub: subcategory.slug }}
      className="group relative block w-full overflow-hidden rounded-sm border border-slate-100/70 bg-[#F8F7F2] text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-[#EAE9E4]">
        <img
          src={src}
          alt={`${subcategory.name} silver jewellery`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" as const } : { fetchPriority: "low" as const })}
          onError={() => setSrc(categoryPlaceholder)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Soft dark scrim on right half for text legibility (matches homepage Antique/CZ tiles) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          style={{
            background:
              "linear-gradient(to left, rgba(6,20,16,0.55) 0%, rgba(6,20,16,0.35) 55%, rgba(6,20,16,0) 100%)",
          }}
        />
        <div className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center px-4 text-center">
          <h2
            className="text-[22px] font-normal leading-[1.05] text-[#F5EFE0]"
            style={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", ui-serif, Georgia, serif',
              letterSpacing: "0.02em",
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            }}
          >
            {subcategory.name}
          </h2>
          <span aria-hidden className="mt-2 block h-px w-8 bg-[#F5EFE0]/60" />
          <p
            className="mt-2 text-[10.5px] font-medium uppercase text-[#F5EFE0]/85"
            style={{
              fontFamily: '"Inter", ui-sans-serif, system-ui',
              letterSpacing: "0.22em",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {count} Designs
          </p>
        </div>
      </div>
    </Link>
  );
}
