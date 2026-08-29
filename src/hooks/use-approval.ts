import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ViewerAccess = {
  loading: boolean;
  /** No session at all. */
  isAnonymous: boolean;
  /** Signed in but profiles.status is not 'active' yet. */
  isPending: boolean;
  /** Approved buyer or admin — full catalogue, wholesale rates, ordering. */
  isApproved: boolean;
  isAdmin: boolean;
  /** Raw profiles.status ('active' | 'pending' | 'rejected' | ...); 'active' for admins, null when anonymous. */
  status: string | null;
};

/**
 * Mirrors the database rule (public.is_approved_user): only an 'active' profile
 * or an admin role may see the full catalogue / wholesale rates / place orders.
 * RLS enforces this server-side; this hook only drives the UI messaging.
 */
export function useApproval(): ViewerAccess {
  const [state, setState] = useState<ViewerAccess>({
    loading: true,
    isAnonymous: true,
    isPending: false,
    isApproved: false,
    isAdmin: false,
    status: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async (userId: string | null) => {
      if (!userId) {
        if (!cancelled)
          setState({ loading: false, isAnonymous: true, isPending: false, isApproved: false, isAdmin: false, status: null });
        return;
      }
      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);
      if (cancelled) return;
      const isAdmin = !!role;
      const isApproved = isAdmin || profile?.status === "active";
      setState({
        loading: false,
        isAnonymous: false,
        isPending: !isApproved,
        isApproved,
        isAdmin,
        status: isAdmin ? "active" : (profile?.status ?? null),
      });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => load(data.session?.user?.id ?? null))
      .catch(() => {
        if (!cancelled)
          setState({ loading: false, isAnonymous: true, isPending: false, isApproved: false, isAdmin: false, status: null });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never await Supabase calls inside the auth callback — defer a tick.
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

  return state;
}
