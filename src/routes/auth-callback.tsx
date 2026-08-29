import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const search = window.location.search;
      const hash = window.location.hash;

      // 1. If in an external browser / Chrome Custom Tab (not inside React Native WebView),
      // bounce immediately to custom scheme to auto-close Custom Tab and return to app
      if (typeof window !== "undefined" && !window.ReactNativeWebView) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `sparklingsilver://auth-callback${search}${hash}`;
        }
      }

      // 2. Process web session exchange
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (hash) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
      }

      setTimeout(() => {
        navigate({ to: "/", replace: true });
      }, 500);
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b2a20] text-white">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="mt-4 text-sm text-white/70">Completing sign-in...</p>
      </div>
    </div>
  );
}
