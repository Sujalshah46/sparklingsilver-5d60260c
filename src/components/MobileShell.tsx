import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, Menu, User as UserIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useCartWeight } from "@/hooks/use-cart-weight";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] font-semibold text-white">
      {data}
    </span>
  );
}

const sideLinks: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/orders", label: "My Orders" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/account", label: "My Account" },
  { to: "/silver-rate", label: "Silver Rate" },
  { to: "/contact", label: "Contact Us" },
  { to: "/blog", label: "Blog" },
];

function SideMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="Open menu" className="grid h-10 w-10 place-items-center text-[#333] hover:bg-[#F4F4F4]">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[78vw] max-w-[320px] p-0">
        <div className="flex h-14 items-center justify-between border-b border-[#E5E5E5] px-4">
          <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">Menu</div>
          <ThemeToggle />
        </div>
        <div className="border-b border-[#E5E5E5] bg-[#F8F8F8] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-[#999]">Signed in as</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[#1A1A1A]">{user?.email ?? "Guest"}</p>
        </div>
        <nav className="py-2">
          {sideLinks.map((l) => (
            <button
              key={l.to}
              onClick={() => navigate({ to: l.to })}
              className="flex w-full items-center justify-between px-4 py-3 text-[15px] text-[#1A1A1A] hover:bg-[#F8F8F8]"
            >
              <span>{l.label}</span>
              <span className="text-[#BBB]">›</span>
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => navigate({ to: "/admin" })}
              className="flex w-full items-center justify-between border-t border-[#E5E5E5] px-4 py-3 text-[15px] font-semibold text-teal hover:bg-[#F8F8F8]"
            >
              <span>Admin Panel</span>
              <span className="text-teal">›</span>
            </button>
          )}
        </nav>
        <p className="px-4 py-3 text-[11px] text-[#999]">v1.0.0 · Sparkling Silver LLP</p>
      </SheetContent>
    </Sheet>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-2" style={{ height: 52 }}>
        <SideMenu />
        <Link to="/" className="min-w-0 truncate text-[15px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]">
          Sparkling Silver LLP
        </Link>
        <div className="flex shrink-0 items-center">
          <Link to="/account" aria-label="Account" className="grid h-10 w-10 place-items-center text-[#333] hover:bg-[#F4F4F4]">
            <UserIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </Link>
          <Link to="/search" aria-label="Search" className="grid h-10 w-10 place-items-center text-[#333] hover:bg-[#F4F4F4]">
            <Search className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const weight = useCartWeight();
  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E5E5] bg-white">
      <div
        className="mx-auto grid max-w-2xl grid-cols-3 items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", height: 56 }}
      >
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isActive("/", true) ? "text-[#1A1A1A]" : "text-[#777]"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={isActive("/", true) ? 2.2 : 1.7} />
          <span>Home</span>
        </Link>
        <Link
          to="/cart"
          className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isActive("/cart") ? "text-[#1A1A1A]" : "text-[#777]"
          }`}
        >
          <div className="relative">
            <ShoppingBag className="h-5 w-5" strokeWidth={isActive("/cart") ? 2.2 : 1.7} />
            <CartBadge />
          </div>
          <span>Cart</span>
        </Link>
        <div className="flex flex-col items-end justify-center pr-4 leading-none">
          <span className="text-[18px] font-bold tabular-nums text-[#1A1A1A]">{weight.toFixed(3)}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#777]">Total (g)</span>
        </div>
      </div>
    </nav>
  );
}

export function MobileShell({ children, hideTopBar = false }: { children: ReactNode; title?: string; hideTopBar?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      {!hideTopBar && <TopBar />}
      <main className="mx-auto max-w-2xl pb-safe-nav">{children}</main>
      <BottomNav />
    </div>
  );
}

export { X };
