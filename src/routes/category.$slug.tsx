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
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.charAt(0).toUpperCase() + params.slug.slice(1)} — Sparkling Jewellers` },
      { name: "description", content: `Browse our ${params.slug} collection — premium gold and diamond jewellery.` },
    ],
  }),
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
