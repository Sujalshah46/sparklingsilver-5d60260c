import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, Heart, User as UserIcon, Bell } from "lucide-react";
import logo from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

function CartBadge() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["cart-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("cart_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });
  if (!data) return null;
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-burgundy px-1 text-[10px] font-semibold text-ivory">
      {data}
    </span>
  );
}

export function TopBar({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <img src={logo} alt="Sparkling Jewellers" className="h-9 w-auto shrink-0" />
          {title && (
            <span className="truncate font-serif text-base font-semibold text-foreground sm:text-lg">{title}</span>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link to="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary">
            <Search className="h-5 w-5" />
          </Link>
          <Link to="/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary">
            <Bell className="h-5 w-5" />
          </Link>
          <Link to="/cart" aria-label="Cart" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-secondary">
            <ShoppingBag className="h-5 w-5" />
            <CartBadge />
          </Link>
        </div>
      </div>
    </header>
  );
}

const tabs = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/catalogue", label: "Shop", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account", label: "Account", icon: UserIcon },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid max-w-2xl grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-burgundy" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "fill-gold/20" : ""}`} strokeWidth={active ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileShell({ children, title, hideTopBar = false }: { children: ReactNode; title?: string; hideTopBar?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      {!hideTopBar && <TopBar title={title} />}
      <main className="mx-auto max-w-2xl pb-safe-nav">{children}</main>
      <BottomNav />
    </div>
  );
}
