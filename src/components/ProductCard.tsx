import { CatalogueCard, type CatalogueCardData } from "@/components/CatalogueCard";

// Back-compat shim: old code imports ProductCard; we render the new
// CatalogueCard so the B2B catalogue look is consistent everywhere.
export type ProductCardData = CatalogueCardData & {
  price?: number | string;
  is_new?: boolean | null;
  is_bestseller?: boolean | null;
};

export function ProductCard({ p, showCart = true }: { p: ProductCardData; showCart?: boolean }) {
  return <CatalogueCard p={p} showCart={showCart} />;
}
