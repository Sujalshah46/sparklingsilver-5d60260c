import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, Menu, User as UserIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useCartWeight } from "@/hooks/use-cart-weight";
import { whatsappUrl, WHATSAPP_LINK_TARGET, openWhatsAppUrl } from "@/lib/site";
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

const buzz = (ms = 15) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(ms); } catch {}
  }
};

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const weight = useCartWeight();
  const navigate = useNavigate();
  const whatsAppHref = whatsappUrl();
  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E5E5] bg-white">
      <div
        className="mx-auto grid max-w-2xl grid-cols-4 items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", height: 56 }}
      >
        <Link
          to="/"
          onClick={() => buzz(12)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isActive("/", true) ? "text-[#1A1A1A]" : "text-[#777]"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={isActive("/", true) ? 2.2 : 1.7} />
          <span>Home</span>
        </Link>
        <Link
          to="/cart"
          onClick={() => buzz(15)}
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
        <button
          type="button"
          onClick={() => { buzz(15); navigate({ to: "/cart" }); }}
          className="flex flex-col items-center justify-center leading-none focus:outline-none"
          aria-label="View cart total weight"
        >
          <span className="text-[16px] font-bold tabular-nums text-[#1A1A1A]">{weight.toFixed(3)}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#777]">Total (g)</span>
        </button>
        <a
          href={whatsAppHref}
          target={WHATSAPP_LINK_TARGET}
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault();
            buzz(20);
            openWhatsAppUrl(whatsAppHref);
          }}
          aria-label="Chat on WhatsApp"
          className="mx-auto grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[0_4px_12px_rgba(37,211,102,0.35)] active:scale-95 transition-transform"
        >
          <svg viewBox="0 0 32 32" className="h-11 w-11" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="#25D366" />
            <path
              fill="#FFFFFF"
              d="M22.9 9.1A9.7 9.7 0 0 0 16.05 6.3c-5.36 0-9.72 4.36-9.72 9.72 0 1.71.45 3.38 1.3 4.85L6.25 25.7l4.98-1.3a9.71 9.71 0 0 0 4.82 1.23h.01c5.36 0 9.72-4.36 9.72-9.72a9.66 9.66 0 0 0-2.88-6.81ZM16.06 24a8.06 8.06 0 0 1-4.11-1.13l-.29-.17-2.96.77.79-2.88-.19-.3a8.05 8.05 0 0 1-1.24-4.28c0-4.46 3.63-8.08 8.09-8.08 2.16 0 4.19.84 5.72 2.37a8.03 8.03 0 0 1 2.37 5.72c0 4.46-3.63 8.08-8.09 8.08Zm4.44-6.05c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.59 4.12 3.63.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.11-.22-.17-.46-.29Z"
            />
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
