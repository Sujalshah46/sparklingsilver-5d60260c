import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { ChevronLeft } from "lucide-react";
import { whatsappUrl } from "@/lib/site";

const categoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (!cat) return null;
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", cat.id as string)
        .limit(48);
      return { category: cat, products: (products ?? []) as CatalogueCardData[] };
    },
  });

export const Route = createFileRoute("/category/$slug")({
  head: ({ params, loaderData }) => {
    const ld = loaderData as { category?: { name: string } } | undefined;
    const name = ld?.category?.name ?? params.slug;
    const title = `${name} — Sparkling Silver`;
    const desc = `Browse our ${name.toLowerCase()} collection — premium 22K & 18K gold and diamond designs with BIS hallmark.`;
    const url = `https://sparkling-jewellers-llp.lovable.app/category/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
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

  return (
    <MobileShell title={data.category.name}>
      <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-2 py-2">
        <Link to="/catalogue" aria-label="Back" className="grid h-9 w-9 place-items-center text-[#333] hover:bg-[#F4F4F4]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-[16px] font-bold text-[#1A1A1A]">
          {data.category.name} <span className="font-normal text-[#777]">({data.products.length})</span>
        </h1>
      </div>

      <div className="px-2 py-3">
        {data.products.length === 0 ? (
          <p className="py-20 text-center text-[#888]">No products yet in this category.</p>
        ) : (
          <div className="grid grid-cols-2 gap-[2px]">
            {data.products.map((p) => <CatalogueCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-[#E5E5E5] bg-white px-3 py-2.5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">Want to view our entire range?</p>
            <p className="truncate text-[10.5px] text-[#666]">Call / WhatsApp us Now!</p>
          </div>
          <a
            href={whatsappUrl(`Hi, I'd like full access — viewing ${data.category.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[2px] bg-teal-dark px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-teal"
          >
            Ask for Access
          </a>
        </div>
      </div>

      <div className="h-24" />
    </MobileShell>
  );
}
