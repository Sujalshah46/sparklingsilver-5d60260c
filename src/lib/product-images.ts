// Maps DB image_url (just the filename) to bundled Vite asset URL
import ring from "@/assets/product-1-ring.jpg";
import necklace from "@/assets/product-2-necklace.jpg";
import earrings from "@/assets/product-3-earrings.jpg";
import kada from "@/assets/product-4-kada.jpg";
import mangalsutra from "@/assets/product-5-mangalsutra.jpg";
import bracelet from "@/assets/product-6-bracelet.jpg";
import pendant from "@/assets/product-7-pendant.jpg";
import jhumka from "@/assets/product-8-jhumka.jpg";
import diamondNecklace from "@/assets/product-9-diamond-necklace.jpg";
import chain from "@/assets/product-10-chain.jpg";

const map: Record<string, string> = {
  "product-1-ring.jpg": ring,
  "product-2-necklace.jpg": necklace,
  "product-3-earrings.jpg": earrings,
  "product-4-kada.jpg": kada,
  "product-5-mangalsutra.jpg": mangalsutra,
  "product-6-bracelet.jpg": bracelet,
  "product-7-pendant.jpg": pendant,
  "product-8-jhumka.jpg": jhumka,
  "product-9-diamond-necklace.jpg": diamondNecklace,
  "product-10-chain.jpg": chain,
};

export function resolveProductImage(filename: string | null | undefined): string {
  if (!filename) return ring;
  return map[filename] ?? ring;
}
