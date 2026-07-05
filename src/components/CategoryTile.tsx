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
      className="group relative flex w-full overflow-hidden rounded-sm border border-slate-100/70 bg-[#F8F7F2] shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-[#EAE9E4]">
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setSrc(categoryPlaceholder)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* +N New badge */}
        {!!newCount && newCount > 0 && (
          <span
            className="absolute right-3 top-3 rounded-sm bg-[#A5D7D2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-tight text-teal-900 shadow-sm"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            +{newCount} New
          </span>
        )}

        {/* Text overlay on right half — image itself provides negative space */}
        <div className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center px-3 text-center">
          <h3
            className="font-serif text-[18px] leading-tight text-slate-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]"
          >
            {name}
          </h3>
          {typeof count === "number" && (
            <p
              className="mt-1.5 text-[12px] text-slate-600"
              style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
            >
              {count} Designs
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
