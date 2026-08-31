import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pageTitle, descriptionTags } from "@/lib/seo";
import { sanitizeRedirect } from "@/lib/site";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth-callback")({
 ssr: false,
 head: () => ({
 meta: [
 { title: pageTitle("Signing you in") },
 ...descriptionTags("Completing secure sign in to your Sparkling Silver account."),
 { name: "robots", content: "noindex" },
 ],
 }),
 component: AuthCallbackPage,
});

const OAUTH_TARGET_KEY = "ss_oauth_redirect";

export function stashOAuthTarget(target: string) {
 try {
 sessionStorage.setItem(OAUTH_TARGET_KEY, target);
 } catch {
 /* private mode */
 }
}

function consumeOAuthTarget(): string {
 try {
 const raw = sessionStorage.getItem(OAUTH_TARGET_KEY);
 sessionStorage.removeItem(OAUTH_TARGET_KEY);
 return sanitizeRedirect(raw ?? "/");
 } catch {
 return "/";
 }
}

function AuthCallbackPage() {
 const navigate = useNavigate();
 const [failed, setFailed] = useState(false);
 const doneRef = useRef(false);

 useEffect(() => {
    const url = new URL(window.location.href);
    const hash = window.location.hash;

    const setSessionFromUrl = async () => {
      try {
        const authCode = url.searchParams.get("code");
        const accessToken =
          url.searchParams.get("access_token") ||
          new URLSearchParams(hash.replace("#", "?")).get("access_token");
        const refreshToken =
          url.searchParams.get("refresh_token") ||
          new URLSearchParams(hash.replace("#", "?")).get("refresh_token");

        if (accessToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? "",
            expires_in: 3600,
          });
        } else if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) {
            console.error("[auth-callback] exchangeCodeForSession failed:", error);
          }
        }
      } catch {
        // Handled below
      }
    };

    setSessionFromUrl();

    const finish = (target?: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
      navigate({ to: target ?? consumeOAuthTarget(), replace: true });
    };

 const fail = () => {
 if (doneRef.current) return;
 doneRef.current = true;
 clearTimeout(timeout);
 sub.subscription.unsubscribe();
 setFailed(true);
 };

 const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
 if (event === "SIGNED_IN" && session?.user) finish();
 });

 supabase.auth.getSession().then(({ data }) => {
 if (data.session?.user) finish();
 });

 const timeout = setTimeout(() => {
 supabase.auth.getSession().then(({ data }) => {
 if (data.session?.user) finish();
 else fail();
 });
 }, 15000);

 return () => {
 clearTimeout(timeout);
 sub.subscription.unsubscribe();
 };
 }, [navigate]);

 return (
 <div
 className="flex min-h-screen w-full flex-col items-center justify-center px-6"
 style={{
 backgroundColor: "#0b2a20",
 backgroundImage:
 "radial-gradient(ellipse 90% 60% at 50% 0%, #164636 0%, #0b2a20 55%, #061a13 100%)",
 }}
 >
 <img src={logo} alt="Sparkling Silver" className="h-24 w-auto" />
 {failed ? (
 <div className="mt-8 text-center">
 <p className="text-sm font-medium text-white">Sign-in could not be completed.</p>
 <p className="mt-1 text-xs text-white/60">The link may have expired. Please try again.</p>
 <button
 type="button"
 onClick={() => navigate({ to: "/auth", replace: true })}
 className="mt-6 rounded-md border border-white/25 bg-white/[0.08] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
 >
 Back to Sign In
 </button>
 </div>
 ) : (
 <div className="mt-8 flex flex-col items-center gap-3" role="status" aria-live="polite">
 <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white" />
 <p className="text-sm font-medium text-white">Signing you in…</p>
 </div>
 )}
 </div>
 );
}
