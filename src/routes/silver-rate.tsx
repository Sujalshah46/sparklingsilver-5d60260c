import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ratesQuery = queryOptions({
  queryKey: ["silver-rates"],
  queryFn: async () => {
    const { data } = await supabase.from("gold_rates").select("*").order("rate_date", { ascending: true }).limit(30);
    return data ?? [];
  },
});

const SR_TITLE = "Today's Silver Rate — 999 & 925 | Sparkling Silver";
const SR_DESC = "Live 999 fine silver and 925 sterling silver rates per gram in India, with a 30-day price chart from Sparkling Silver LLP.";

export const Route = createFileRoute("/silver-rate")({
  head: () => ({
    meta: [
      { title: SR_TITLE },
      { name: "description", content: SR_DESC },
      { property: "og:title", content: SR_TITLE },
      { property: "og:description", content: SR_DESC },
      { property: "og:url", content: "https://sparkling-jewellers-llp.lovable.app/silver-rate" },
    ],
    links: [{ rel: "canonical", href: "https://sparkling-jewellers-llp.lovable.app/silver-rate" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ratesQuery),
  component: SilverRatePage,
});

function SilverRatePage() {
  const { data } = useSuspenseQuery(ratesQuery);
  const today = data[data.length - 1];
  const chartData = data.map((r) => {
    const fine = Number(r.silver);
    return {
      date: new Date(r.rate_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      "999": fine,
      "925": Number((fine * 0.925).toFixed(2)),
      "800": Number((fine * 0.8).toFixed(2)),
    };
  });

  const fineToday = today ? Number(today.silver) : 0;
  const sterling = (fineToday * 0.925).toFixed(2);
  const coin = (fineToday * 0.8).toFixed(2);

  return (
    <MobileShell title="Silver Rate">
      <div className="space-y-6 p-4">
        <header>
          <h1 className="font-serif text-2xl font-bold">Today's Silver Rate</h1>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Updated {today && new Date(today.rate_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · per gram
          </p>
        </header>

        {today && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "999 Fine Silver", v: fineToday.toFixed(2), hue: "bg-secondary border-border" },
              { k: "925 Sterling", v: sterling, hue: "bg-secondary border-border" },
              { k: "800 Silver", v: coin, hue: "bg-secondary border-border" },
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
          <h2 className="font-serif text-lg font-semibold">Last 30 Days</h2>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Line type="monotone" dataKey="999" stroke="#5BBFAD" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="925" stroke="#6D1F2E" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="800" stroke="#888888" strokeWidth={2} dot={false} />
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
