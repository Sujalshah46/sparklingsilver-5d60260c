import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Row = { quantity: number | null; product: { net_weight: number | string | null } | null };

export function useCartWeight() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["cart-weight", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("quantity, product:products(net_weight)")
        .eq("user_id", user!.id);
      if (error) return 0;
      return (data as unknown as Row[]).reduce((sum, r) => {
        const qty = Number(r.quantity ?? 0);
        const w = Number(r.product?.net_weight ?? 0);
        return sum + qty * w;
      }, 0);
    },
  });
  return data ?? 0;
}
