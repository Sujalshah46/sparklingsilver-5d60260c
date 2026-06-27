import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { inr, formatDate } from "@/lib/format";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My Orders — Sparkling Silver" }] }),
  component: OrdersPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-green-100 text-green-900",
  rejected: "bg-destructive/15 text-destructive",
  placed: "bg-secondary text-foreground",
  processing: "bg-gold/20 text-charcoal",
  ready: "bg-gold/20 text-charcoal",
  dispatched: "bg-blue-100 text-blue-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-destructive/15 text-destructive",
};

function OrdersPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(count)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <MobileShell title="My Orders">
      <div className="p-4">
        {!data?.length ? (
          <div className="py-20 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-serif text-xl">No orders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your purchases will appear here.</p>
            <Button asChild className="mt-6"><Link to="/catalogue">Start Shopping</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((o) => (
              <li key={o.id}>
                <Link to="/orders/$id" params={{ id: o.id }} className="block rounded-xl border border-border bg-card p-4 transition hover:border-gold">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-serif text-sm font-semibold">{o.order_no}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(o.created_at)} · {(o.order_items as unknown as { count: number }[])?.[0]?.count ?? 0} items</p>
                    </div>
                    <Badge className={statusColor[o.status] ?? ""}>{o.status}</Badge>
                  </div>
                  <p className="mt-2 font-serif text-base font-semibold text-burgundy">{inr(o.total)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
