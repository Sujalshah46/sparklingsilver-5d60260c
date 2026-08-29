import type { ImageVariants } from "@/lib/product-images";

export type CartItem = {
  id: string;
  quantity: number;
  size: string | null;
  remark: string | null;
  product: {
    id: string;
    slug: string | null;
    name: string;
    sku: string | null;
    purity: string | null;
    gross_weight: number | string | null;
    image_url: string | null;
    image_variants: ImageVariants | null;
  } | null;
};

export function calculateTotalGrossWeight(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const weight = Number(item.product?.gross_weight ?? 0);
    return sum + weight * item.quantity;
  }, 0);
}

export function calculateTotalPieces(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
