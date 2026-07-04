import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { resolveProductImage, categoryPlaceholder } from "@/lib/product-images";

export function CategoryTile({
  slug, name, image, count, newCount,
}: { slug: string; name: string; image?: string | null; count?: number; newCount?: number }) {
  const [src, setSrc] = useState(() => resolveProductImage(image ?? null, categoryPlaceholder));
  return (
    <Link
      to="/category/$slug"
      params={{ slug }}
      className="group relative flex w-full flex-col overflow-hidden rounded-sm border border-slate-100/70 bg-[#F8F7F2] shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#EAE9E4]">
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setSrc(categoryPlaceholder)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!!newCount && newCount > 0 && (
          <span
            className="absolute right-3 top-3 rounded-sm bg-[#A5D7D2] px-2 py-1 text-[11px] font-semibold uppercase tracking-tight text-teal-900 shadow-sm"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            +{newCount} New
          </span>
        )}
      </div>
      <div className="bg-white px-4 py-3">
        <h3 className="font-serif text-lg font-medium text-slate-800">{name}</h3>
        {typeof count === "number" && (
          <p
            className="mt-0.5 text-[11px] text-slate-500"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            Designs: {count} Pcs
          </p>
        )}
      </div>
    </Link>
  );
}
