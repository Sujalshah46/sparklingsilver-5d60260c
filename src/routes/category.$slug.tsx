import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (!cat) return null;
      const { data: products } = await supabase.from("products").select("*").eq("category_id", cat.id as string);
      return { category: cat, products: (products ?? []) as ProductCardData[] };
    },
  });

export const Route = createFileRoute("/category/$slug")({
  head: ({ params, loaderData }) => {
    const ld = loaderData as { category?: { name: string } } | undefined;
    const name = ld?.category?.name ?? params.slug;
    const title = `${name} — Sparkling Jewellers`;
    const desc = `Browse our ${name.toLowerCase()} collection — premium 22K & 18K gold and diamond designs with BIS hallmark.`;
    const url = `https://cuddly-code-gen.lovable.app/category/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: ld
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: title,
                url,
                description: desc,
                isPartOf: { "@type": "WebSite", name: "Sparkling Jewellers LLP", url: "https://cuddly-code-gen.lovable.app" },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "https://cuddly-code-gen.lovable.app/" },
                  { "@type": "ListItem", position: 2, name: "Shop", item: "https://cuddly-code-gen.lovable.app/catalogue" },
                  { "@type": "ListItem", position: 3, name, item: url },
                ],
              }),
            },
          ]
        : [],
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

  return (
    <MobileShell title={data.category.name}>
      <div className="px-4 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">{data.category.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.products.length} designs</p>
      </div>
      <div className="px-3 py-4">
        {data.products.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">No products yet in this category.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
