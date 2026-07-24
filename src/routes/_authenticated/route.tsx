import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const EXEMPT_PATHS = ["/complete-profile", "/change-password"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));
    if (!isExempt) {
      // Admins bypass onboarding
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_completed, must_change_password")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.must_change_password) {
          throw redirect({ to: "/change-password" });
        }
        if (!profile?.profile_completed) {
          throw redirect({
            to: "/complete-profile",
            search: { redirect: location.pathname + location.search },
          });
        }
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
