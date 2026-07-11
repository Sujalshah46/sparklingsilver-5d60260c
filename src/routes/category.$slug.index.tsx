import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";
import { ArrowUpDown, ChevronLeft, LayoutGrid, ListFilter, Rows2, Rows3 } from "lucide-react";
import { whatsappUrl } from "@/lib/site";
import { SUBCATEGORY_IMAGES, categoryPlaceholder, resolveProductImage } from "@/lib/product-images";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type SortKey = "featured" | "new" | "weight_asc" | "weight_desc" | "sku_asc";
type ViewStyle = "grid2" | "grid1" | "compact";
type Subcategory = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "new", label: "Newest First" },
  { key: "weight_asc", label: "Weight: Low to High" },
  { key: "weight_desc", label: "Weight: High to Low" },
  { key: "sku_asc", label: "SKU (A → Z)" },
];

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
        .limit(96);
      const { data: links } = await supabase
        .from("category_subcategories")
        .select("subcategory_id")
        .eq("category_id", cat.id as string);
      const ids = (links ?? []).map((link) => link.subcategory_id);
      const { data: subcategories } = ids.length
        ? await supabase.from("subcategories").select("*").in("id", ids).order("sort_order")
        : { data: [] as Subcategory[] };

      // Per-subcategory product counts (scoped to this category)
      const counts: Record<string, number> = {};
      await Promise.all(
        (subcategories ?? []).map(async (s) => {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("category_id", cat.id as string)
            .eq("subcategory_id", s.id);
          counts[s.id] = count ?? 0;
        }),
      );

      return {
        category: cat,
        products: (products ?? []) as CatalogueCardData[],
        subcategories: (subcategories ?? []) as Subcategory[],
        subcategoryCounts: counts,
      };

    },
  });

export const Route = createFileRoute("/category/$slug/")({
  head: ({ params, loaderData }) => {
    const ld = loaderData as { category?: { name: string } } | undefined;
    const name = ld?.category?.name ?? params.slug;
    const title = `${name} — Sparkling Silver`;
    const desc = `Browse our ${name.toLowerCase()} collection — premium 925 sterling silver designs with BIS hallmark.`;
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

type Filters = { onlyNew: boolean; onlyBestseller: boolean };

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(categoryQuery(slug));

  const [sort, setSort] = useState<SortKey>("featured");
  const [view, setView] = useState<ViewStyle>("grid2");
  const [filters, setFilters] = useState<Filters>({ onlyNew: false, onlyBestseller: false });
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  

  useEffect(() => {
    try {
      const v = localStorage.getItem("sj.viewStyle") as ViewStyle | null;
      if (v === "grid1" || v === "grid2" || v === "compact") setView(v);
      const s = localStorage.getItem("sj.sortKey") as SortKey | null;
      if (s) setSort(s);
    } catch {}
  }, []);
  const updateView = (v: ViewStyle) => {
    setView(v);
    try { localStorage.setItem("sj.viewStyle", v); } catch {}
  };
  const updateSort = (s: SortKey) => {
    setSort(s);
    try { localStorage.setItem("sj.sortKey", s); } catch {}
    setSortOpen(false);
  };

  const items = useMemo(() => {
    if (!data) return [] as CatalogueCardData[];
    let arr = [...data.products] as (CatalogueCardData & { subcategory_id?: string | null; is_new?: boolean; is_bestseller?: boolean; created_at?: string })[];
    if (filters.onlyNew) arr = arr.filter((p) => p.is_new);
    if (filters.onlyBestseller) arr = arr.filter((p) => p.is_bestseller);
    switch (sort) {
      case "weight_asc": arr.sort((a, b) => Number(a.gross_weight) - Number(b.gross_weight)); break;
      case "weight_desc": arr.sort((a, b) => Number(b.gross_weight) - Number(a.gross_weight)); break;
      case "sku_asc": arr.sort((a, b) => String(a.sku).localeCompare(String(b.sku))); break;
      case "new": arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")); break;
      default: break;
    }
    return arr;
  }, [data, sort, filters]);

  // scroll spy: track how many cards have entered the viewport
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    const seen = new Set<number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset.idx);
        if (e.isIntersecting) seen.add(idx);
      }
      const max = seen.size === 0 ? 0 : Math.max(...seen) + 1;
      setVisibleCount(Math.min(max, cards.length));
    }, { threshold: 0.3 });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length, view]);

  if (!data) return null;

  const total = items.length;
  const gridClass =
    view === "grid1" ? "grid grid-cols-1 gap-2" :
    view === "compact" ? "grid grid-cols-3 gap-[2px]" :
    "grid grid-cols-2 gap-[2px]";
  const activeFilterCount = (filters.onlyNew ? 1 : 0) + (filters.onlyBestseller ? 1 : 0);

  return (
    <MobileShell title={data.category.name}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-2 py-2">
        <Link to="/catalogue" aria-label="Back" className="grid h-9 w-9 place-items-center text-[#333] hover:bg-[#F4F4F4]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-[16px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">
          {data.category.name} <span className="font-normal text-[#777]">({data.products.length})</span>
        </h1>
      </div>

      {/* Sort / Filter / View toolbar */}
      <div className="sticky top-[52px] z-20 flex items-stretch justify-between border-b border-[#E5E5E5] bg-white text-[12px] font-semibold text-[#1A1A1A]">
        <button
          onClick={() => setSortOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 py-3 hover:bg-[#F8F8F8]"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-teal" />
          <span className="uppercase tracking-wider">Sort</span>
        </button>
        <div className="w-px bg-[#E5E5E5]" />
        <button
          onClick={() => setFilterOpen(true)}
          className="relative flex flex-1 items-center justify-center gap-1.5 py-3 hover:bg-[#F8F8F8]"
        >
          <ListFilter className="h-3.5 w-3.5 text-teal" />
          <span className="uppercase tracking-wider">Filter</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="w-px bg-[#E5E5E5]" />
        <div className="flex flex-1 items-center justify-center gap-2 py-2">
          <span className="text-[11px] uppercase tracking-wider text-[#777]">View</span>
          <div className="inline-flex overflow-hidden rounded-[2px] border border-[#DDD]">
            <button
              aria-label="Two column"
              onClick={() => updateView("grid2")}
              className={`grid h-7 w-8 place-items-center ${view === "grid2" ? "bg-teal text-white" : "text-[#555]"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="One column"
              onClick={() => updateView("grid1")}
              className={`grid h-7 w-8 place-items-center border-l border-[#DDD] ${view === "grid1" ? "bg-teal text-white" : "text-[#555]"}`}
            >
              <Rows2 className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Compact grid"
              onClick={() => updateView("compact")}
              className={`grid h-7 w-8 place-items-center border-l border-[#DDD] ${view === "compact" ? "bg-teal text-white" : "text-[#555]"}`}
            >
              <Rows3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Subcategories */}
      {data.subcategories.length > 0 && (
        <section className="px-3 py-4">
          <div className="mb-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A]">Subcategories</p>
            <span className="mt-1 block h-px w-8 bg-teal" />
          </div>
          <div className="flex flex-col gap-3">
            {data.subcategories.map((subcat) => (
              <SubcategoryTile
                key={subcat.id}
                categorySlug={slug}
                subcategory={subcat}
                count={data.subcategoryCounts?.[subcat.id] ?? 0}
              />
            ))}
          </div>
        </section>
      )}


      {/* Grid */}
      <div className="px-2 py-3">
        {items.length === 0 ? (
          <p className="py-20 text-center text-[#888]">No products match your filters.</p>
        ) : (
          <div ref={gridRef} className={gridClass}>
            {items.map((p, i) => (
              <div key={p.id} data-card data-idx={i}>
                <CatalogueCard p={p} compact={view === "compact"} priority={i < 4} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating product-count pill */}
      {total > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[112px] z-20 flex justify-center">
          <div className="pointer-events-auto rounded-full bg-[#1A1A1A]/85 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg backdrop-blur">
            {Math.max(1, visibleCount)} / {total} Product(s)
          </div>
        </div>
      )}

      {/* Bottom access banner */}
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

      <div className="h-28" />

      {/* Sort sheet */}
      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b border-[#EEE] px-4 py-3 text-left">
            <SheetTitle className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">Sort by</SheetTitle>
          </SheetHeader>
          <ul className="max-h-[60vh] overflow-y-auto">
            {SORTS.map((s) => (
              <li key={s.key}>
                <button
                  onClick={() => updateSort(s.key)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-[14px] ${sort === s.key ? "font-semibold text-teal" : "text-[#1A1A1A]"} hover:bg-[#F8F8F8]`}
                >
                  <span>{s.label}</span>
                  {sort === s.key && <span className="text-teal">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetTrigger asChild><span className="hidden" /></SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="border-b border-[#EEE] px-4 py-3 text-left">
            <SheetTitle className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">Filter</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 p-4">
            <label className="flex items-center justify-between rounded-[3px] border border-[#EEE] px-3 py-3">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1A1A]">New Arrivals only</p>
                <p className="text-[11px] text-[#777]">Show freshly added designs</p>
              </div>
              <input
                type="checkbox"
                checked={filters.onlyNew}
                onChange={(e) => setFilters((f) => ({ ...f, onlyNew: e.target.checked }))}
                className="h-4 w-4 accent-teal"
              />
            </label>
            <label className="flex items-center justify-between rounded-[3px] border border-[#EEE] px-3 py-3">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1A1A]">Bestsellers only</p>
                <p className="text-[11px] text-[#777]">Top-selling silver pieces</p>
              </div>
              <input
                type="checkbox"
                checked={filters.onlyBestseller}
                onChange={(e) => setFilters((f) => ({ ...f, onlyBestseller: e.target.checked }))}
                className="h-4 w-4 accent-teal"
              />
            </label>
          </div>
          <div className="flex gap-2 border-t border-[#EEE] p-3">
            <button
              onClick={() => setFilters({ onlyNew: false, onlyBestseller: false })}
              className="flex-1 rounded-[2px] border border-[#DDD] px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider text-[#333] hover:bg-[#F4F4F4]"
            >
              Reset
            </button>
            <button
              onClick={() => setFilterOpen(false)}
              className="flex-1 rounded-[2px] bg-teal px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white hover:bg-teal-dark"
            >
              Apply
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </MobileShell>
  );
}

function SubcategoryTile({
  categorySlug,
  subcategory,
  count,
}: {
  categorySlug: string;
  subcategory: Subcategory;
  count: number;
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
          loading="lazy"
          onError={() => setSrc(categoryPlaceholder)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center px-4 text-center">
          <h2
            className="text-[22px] font-normal leading-[1.05] text-slate-900"
            style={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", ui-serif, Georgia, serif',
              letterSpacing: "0.02em",
              textShadow: "0 1px 2px rgba(255,255,255,0.55)",
            }}
          >
            {subcategory.name}
          </h2>
          <span aria-hidden className="mt-2 block h-px w-6 bg-slate-400/60" />
          <p
            className="mt-2 text-[10.5px] font-medium uppercase text-slate-600"
            style={{ fontFamily: '"Inter", ui-sans-serif, system-ui', letterSpacing: "0.22em" }}
          >
            {count} Designs
          </p>
        </div>
      </div>
    </Link>
  );
}
