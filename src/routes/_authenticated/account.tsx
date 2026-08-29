import { pageTitle } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { AppStoreBadges } from "@/components/AppStoreBadges";
import {
  MapPin, Bell, Globe, HelpCircle, Info, LogOut, ChevronRight,
  ShoppingBag, Heart, Gift, UserCog, ShieldCheck, Trash2, FileText, MessageSquarePlus
} from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { deleteOwnAccount } from "@/lib/account.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";


export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: pageTitle("My Account") }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();


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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const requestDelete = useServerFn(deleteOwnAccount);
  const deleteAccount = useMutation({
    mutationFn: async () => { await requestDelete({ data: {} }); },
    onSuccess: async () => {
      setDeleteOpen(false);
      toast.success("Your account has been deleted.");
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not delete account"),
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

        <section className="mt-4 grid grid-cols-2 gap-2">
          <QuickLink to="/orders" icon={ShoppingBag} label="Orders" />
          <QuickLink to="/wishlist" icon={Heart} label="Wishlist" />
        </section>

        <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <Row to="/addresses" icon={MapPin} label="My Addresses" />
          <Row to="/account-edit" icon={UserCog} label="Personal & Business Details" />
          <Row to="/notifications" icon={Bell} label="Notifications" />
          <Row icon={Globe} label="Language" hint="English" />
        </section>

        <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <FeedbackModal
            trigger={
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-secondary/50 text-left">
                <MessageSquarePlus className="h-4 w-4 text-teal" />
                <span className="flex-1 font-medium text-slate-900">Request Jewellery Design / Feedback</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            }
          />
          <Row to="/contact" icon={HelpCircle} label="Help & Support" />
          <Row to="/privacy" icon={ShieldCheck} label="Privacy Policy" />
          <Row to="/terms" icon={FileText} label="Terms of Use" />
          <Row icon={Info} label="About Sparkling Silver" hint="v1.0" />
        </section>

        {isAdmin && (
          <section className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-burgundy bg-card">
            <Row to="/admin" icon={ShieldCheck} label="Admin Panel" hint="Manage orders" />
          </section>
        )}

        <div className="mt-6">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Download Our App
          </p>
          <AppStoreBadges />
        </div>


        <Button
          variant="outline"
          className="mt-6 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => signOut.mutate()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>

        {!isAdmin && (
          <Button
            variant="ghost"
            className="mt-2 w-full text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete my account
          </Button>
        )}

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This closes your Sparkling Silver account permanently. Your cart, wishlist
                and saved details are removed and you will no longer be able to sign in.
                Past order records are kept only as required for tax and accounting law.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Keep my account
              </Button>
              <Button
                variant="destructive"
                disabled={deleteAccount.isPending}
                onClick={() => deleteAccount.mutate()}
              >
                {deleteAccount.isPending ? "Deleting…" : "Delete account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Sparkling Silver · BIS Hallmarked · Made with love in India
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
