import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function GoldRateStrip() {
  const { data } = useQuery({
    queryKey: ["gold-rate-today"],
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
      to="/gold-rate"
      className="block border-y border-gold/30 gold-gradient text-charcoal"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 overflow-x-auto px-4 py-2 scrollbar-hide">
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
          <TrendingUp className="h-3.5 w-3.5" /> Today's Rate
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs font-medium">
          <span>24K <strong>₹{data.gold_24k}</strong></span>
          <span>22K <strong>₹{data.gold_22k}</strong></span>
          <span>18K <strong>₹{data.gold_18k}</strong></span>
          <span className="hidden sm:inline">Silver <strong>₹{data.silver}</strong></span>
        </div>
      </div>
    </Link>
  );
}
