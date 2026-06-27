import { Link } from "@tanstack/react-router";
import { resolveProductImage } from "@/lib/product-images";

export function CategoryTile({
  slug, name, image, count, newCount,
}: { slug: string; name: string; image?: string | null; count?: number; newCount?: number }) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug }}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[4px] bg-[#F0F0F0]"
    >
      <img
        src={resolveProductImage(image ?? null)}
        alt={name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {!!newCount && newCount > 0 && (
        <span className="absolute right-2 top-2 rounded-[4px] bg-teal px-2 py-0.5 text-[10px] font-semibold text-white">
          +{newCount} New
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5">
        <p className="text-[15px] font-semibold leading-tight text-white">{name}</p>
        {typeof count === "number" && (
          <p className="text-[11px] text-white/85">Designs: {count} Pcs</p>
        )}
      </div>
    </Link>
  );
}
