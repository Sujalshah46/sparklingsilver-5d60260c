import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function SilverRateStrip() {
  const { data } = useQuery({
    queryKey: ["silver-rate-today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gold_rates")
        .select("*")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!data) return null;
  return (
    <Link
      to="/silver-rate"
      className="block border-y border-gold/30 gold-gradient text-charcoal"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 overflow-x-auto px-4 py-2 scrollbar-hide">
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
          <TrendingUp className="h-3.5 w-3.5" /> Today's Silver Rate
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs font-medium">
          <span>999 Fine <strong>₹{data.silver}</strong>/g</span>
          <span>925 Sterling <strong>₹{(Number(data.silver) * 0.925).toFixed(2)}</strong>/g</span>
        </div>
      </div>
    </Link>
  );
}
