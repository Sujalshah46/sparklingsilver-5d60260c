import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, Menu, User as UserIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useCartWeight } from "@/hooks/use-cart-weight";
import { whatsappUrl } from "@/lib/site";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
        <VisuallyHidden>
          <SheetTitle>Main menu</SheetTitle>
          <SheetDescription>Navigate to sections of Sparkling Silver LLP.</SheetDescription>
        </VisuallyHidden>
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
        className="mx-auto grid max-w-2xl grid-cols-[1fr_1fr_1fr_auto] items-center"
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
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="text-[16px] font-bold tabular-nums text-[#1A1A1A]">{weight.toFixed(3)}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#777]">Total (g)</span>
        </div>
        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(37,211,102,0.35)] ring-1 ring-black/10"
          style={{ background: "linear-gradient(180deg, #25D366 0%, #1EBE5D 100%)" }}
        >
          <svg viewBox="0 0 32 32" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.708.888.66 0 1.876-.387 2.206-1.02.13-.26.155-.518.155-.79 0-.59-2.32-1.205-2.32-1.205zM16.115 0C7.246 0 .046 7.2.046 16.07c0 2.66.66 5.275 1.917 7.62L0 32l8.5-2.217a16.083 16.083 0 0 0 7.615 1.936c8.87 0 16.07-7.2 16.07-16.07S24.985 0 16.115 0z" />
          </svg>
        </a>
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
