import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin, Bell, Globe, HelpCircle, Info, LogOut, ChevronRight,
  ShoppingBag, Heart, Gift, UserCog
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — Sparkling Jewellers" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const signOut = useMutation({
    mutationFn: async () => { await supabase.auth.signOut(); },
    onSuccess: () => { toast.success("Signed out"); navigate({ to: "/", replace: true }); },
  });

  const initials = (profile?.full_name || user?.email || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <MobileShell title="Account">
      <div className="p-4">
        <section className="flex items-center gap-3 rounded-2xl bg-burgundy p-4 text-ivory">
          <Avatar className="h-14 w-14 border-2 border-gold">
            <AvatarFallback className="bg-gold text-charcoal font-serif text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold">{profile?.full_name || "Welcome"}</p>
            <p className="truncate text-xs text-ivory/80">{user?.email}</p>
            {profile?.mobile && <p className="text-xs text-ivory/80">{profile.mobile}</p>}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <QuickLink to="/orders" icon={ShoppingBag} label="Orders" />
          <QuickLink to="/wishlist" icon={Heart} label="Wishlist" />
          <QuickLink to="/gold-rate" icon={Gift} label="Gold Rate" />
        </section>

        <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <Row to="/addresses" icon={MapPin} label="My Addresses" />
          <Row to="/account-edit" icon={UserCog} label="Personal & Business Details" />
          <Row to="/notifications" icon={Bell} label="Notifications" />
          <Row icon={Globe} label="Language" hint="English" />
        </section>

        <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <Row to="/contact" icon={HelpCircle} label="Help & Support" />
          <Row icon={Info} label="About Sparkling Jewellers LLP" hint="v1.0" />
        </section>

        <Button
          variant="outline"
          className="mt-6 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => signOut.mutate()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Sparkling Jewellers LLP · BIS Hallmarked · Made with love in India
        </p>
      </div>
    </MobileShell>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof MapPin; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-xs font-medium hover:border-gold">
      <Icon className="h-5 w-5 text-burgundy" />
      {label}
    </Link>
  );
}

function Row({ to, icon: Icon, label, hint }: { to?: string; icon: typeof MapPin; label: string; hint?: string }) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-secondary/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return <div>{content}</div>;
}
