import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { resolveProductImage } from "@/lib/product-images";
import { Package, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rollupStatus, statusBadgeClass } from "@/lib/order-rollup";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: pageTitle("My Orders") }] }),
  component: OrdersPage,
});



function OrdersPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_no, status, created_at, order_items(id, product_name, product_sku, quantity, size, image_url, status)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });


  return (
    <MobileShell title="My Orders">
      <div className="p-4">
        {isLoading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">Loading your orders…</p>
        ) : !data?.length ? (
          <div className="py-20 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 font-serif text-xl">No orders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your purchases will appear here.</p>
            <Button asChild className="mt-6"><Link to="/catalogue">Start Shopping</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((o) => {
              const items = (o.order_items ?? []) as unknown as {
                id: string; product_name: string; product_sku: string | null;
                quantity: number; size: string | null; image_url: string | null; status?: string | null;
              }[];
              const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
              const roll = rollupStatus(
                items.map((i) => i.status ?? (o.status as string)),
                o.status as string,
              );
              return (
                <li key={o.id}>
                  <Link to="/orders/$id" params={{ id: o.id }} className="block rounded-xl border border-border bg-card p-4 transition hover:border-gold">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-serif text-sm font-semibold">{o.order_no}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(o.created_at)} · {items.length} SKU{items.length === 1 ? "" : "s"} · {totalQty} pcs
                        </p>
                      </div>
                      <Badge data-testid={`order-rollup-${o.order_no}`} className={statusBadgeClass(roll.status)}>{roll.label}</Badge>
                    </div>

                    {items.length > 0 && (
                      <>
                        <div className="mt-3 flex gap-2 overflow-hidden">
                          {items.slice(0, 4).map((it) => (
                            <img
                              key={it.id}
                              src={resolveProductImage(it.image_url)}
                              alt={it.product_name}
                              width={48}
                              height={48}
                              loading="lazy"
                              className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                            />
                          ))}
                          {items.length > 4 && (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-[11px] font-medium">
                              +{items.length - 4}
                            </div>
                          )}
                        </div>
                        <ul className="mt-2 space-y-0.5">
                          {items.slice(0, 2).map((it) => (
                            <li key={it.id} className="truncate text-[11px] text-muted-foreground">
                              {it.product_sku ? `${it.product_sku} · ` : ""}{it.product_name} × {it.quantity}
                              {it.size ? ` · Size ${it.size}` : ""}
                            </li>
                          ))}
                          {items.length > 2 && (
                            <li className="text-[11px] text-muted-foreground">+{items.length - 2} more item{items.length - 2 === 1 ? "" : "s"}</li>
                          )}
                        </ul>
                      </>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] font-semibold text-burgundy">
                      <span>View order details</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>

                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}

