import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ratesQuery = queryOptions({
  queryKey: ["gold-rates"],
  queryFn: async () => {
    const { data } = await supabase.from("gold_rates").select("*").order("rate_date", { ascending: true }).limit(30);
    return data ?? [];
  },
});

const GR_TITLE = "Today's Gold Rate — 22K & 18K | Sparkling Silver";
const GR_DESC = "Live 24K, 22K and 18K gold and silver rates per gram in India, with a 30-day price chart from Sparkling Silver.";

export const Route = createFileRoute("/gold-rate")({
  head: () => ({
    meta: [
      { title: GR_TITLE },
      { name: "description", content: GR_DESC },
      { property: "og:title", content: GR_TITLE },
      { property: "og:description", content: GR_DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/gold-rate" },
    ],
    links: [{ rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/gold-rate" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ratesQuery),
  component: GoldRatePage,
});

function GoldRatePage() {
  const { data } = useSuspenseQuery(ratesQuery);
  const today = data[data.length - 1];
  const chartData = data.map((r) => ({
    date: new Date(r.rate_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    "24K": Number(r.gold_24k),
    "22K": Number(r.gold_22k),
    "18K": Number(r.gold_18k),
  }));

  return (
    <MobileShell title="Gold Rate">
      <div className="space-y-6 p-4">
        <header>
          <h1 className="font-serif text-2xl font-bold">Today's Gold Rate</h1>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Updated {today && new Date(today.rate_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · per gram
          </p>
        </header>

        {today && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "24K Gold", v: today.gold_24k, hue: "bg-gold/15 border-gold/40" },
              { k: "22K Gold", v: today.gold_22k, hue: "bg-gold/15 border-gold/40" },
              { k: "18K Gold", v: today.gold_18k, hue: "bg-gold/10 border-gold/30" },
              { k: "Silver", v: today.silver, hue: "bg-secondary border-border" },
            ].map((c) => (
              <div key={c.k} className={`rounded-xl border p-4 ${c.hue}`}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.k}</p>
                <p className="mt-1 font-serif text-2xl font-bold text-foreground">₹{c.v}</p>
                <p className="text-[11px] text-muted-foreground">per gram</p>
              </div>
            ))}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-lg font-semibold">Last 7 Days</h2>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Line type="monotone" dataKey="24K" stroke="#c9a84c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="22K" stroke="#6D1F2E" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="18K" stroke="#B76E79" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <p className="text-center text-[11px] text-muted-foreground">
          Rates are indicative and may vary at the time of purchase.
        </p>
      </div>
    </MobileShell>
  );
}
