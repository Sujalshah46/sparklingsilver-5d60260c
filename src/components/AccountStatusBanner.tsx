import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Non-blocking notice for signed-in buyers whose account is not yet approved.
 * Browsing is never interrupted — this only explains why prices / ordering are
 * unavailable.
 */
export function AccountStatusBanner() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (userId: string | null) => {
      if (!userId) {
        if (!cancelled) setStatus(null);
        return;
      }
      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);
      if (cancelled) return;
      setStatus(role ? "active" : (profile?.status ?? null));
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null)).catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const id = session?.user?.id ?? null;
      setTimeout(() => {
        if (!cancelled) load(id);
      }, 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status !== "pending" && status !== "rejected") return null;

  const rejected = status === "rejected";

  return (
    <div
      role="status"
      className={`mx-3 mt-3 flex items-start gap-3 rounded-md border p-3 ${
        rejected ? "border-destructive/40 bg-destructive/5" : "border-gold/40 bg-card"
      }`}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/50 bg-background">
        {rejected ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Clock className="h-4 w-4 text-gold" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">
          {rejected ? "Your account was not approved" : "Your account is under review"}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {rejected
            ? "You can keep browsing our featured designs. Please contact our team if you believe this was a mistake."
            : "Full catalogue, wholesale rates and ordering will be available once approved. You can browse featured designs in the meantime."}
        </p>
        <Link
          to="/contact"
          className="mt-1 inline-block text-[13px] font-semibold text-burgundy underline underline-offset-2"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
