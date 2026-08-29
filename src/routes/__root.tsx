import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingGate } from "@/components/OnboardingGate";
import { NativePushBridge } from "@/components/NativePushBridge";



import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { themeInitScript } from "@/components/ThemeToggle";
import { jsonLdScript, websiteSchema, organizationSchema } from "@/lib/seo";

// Guideline 5.1.1(v): browsing must never require an account. Only
// account-specific paths are gated before hydration.
const authGateScript = `(function(){try{var p=location.pathname;var priv=['/cart','/checkout','/orders','/account','/account-edit','/addresses','/wishlist','/notifications','/admin','/change-password'];var m=false;for(var j=0;j<priv.length;j++){if(p===priv[j]||p.indexOf(priv[j]+'/')===0){m=true;break;}}if(!m)return;var keys=Object.keys(localStorage);for(var i=0;i<keys.length;i++){var k=keys[i];if(k.indexOf('sb-')===0&&k.indexOf('-auth-token')>0){try{var v=JSON.parse(localStorage.getItem(k));if(v&&v.access_token&&(!v.expires_at||v.expires_at*1000>Date.now()))return;}catch(e){}}}location.replace('/auth?redirect='+encodeURIComponent(p+location.search));}catch(e){}})();`;

// Move visitors onto the single canonical origin (www) BEFORE they can start an
// OAuth flow. The broker binds the OAuth `state` to the initiating origin, so a
// flow begun on the apex host or the *.lovable.app host and returned to www
// fails with "State verification failed". Editor preview / local dev hosts are
// left alone so sign-in still returns to the preview.
const canonicalHostScript = `(function(){try{var h=location.host;if(location.protocol!=='https:')return;if(h.indexOf('id-preview--')>-1||h.indexOf('.lovableproject.com')>-1||h.indexOf('.lovable.dev')>-1)return;var canon='www.sparklingsilver.in';if(h===canon)return;var ours=(h==='sparklingsilver.in')||h.indexOf('.lovable.app')>-1;if(!ours)return;location.replace('https://'+canon+location.pathname+location.search+location.hash);}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-bold gold-text">404</h1>
        <h2 className="mt-4 font-serif text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#6D1F2E" },
      { property: "og:site_name", content: "Sparkling Silver" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "author", content: "Sparkling Silver" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" } as unknown as { rel: string; href: string },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap" },
    ],
    scripts: [
      {
        children: canonicalHostScript,
      },
      {
        children: authGateScript,
      },
      {
        children: themeInitScript,
      },
      jsonLdScript(websiteSchema()),
      jsonLdScript(organizationSchema()),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const PRIVATE_PATH_PREFIXES = [
  "/cart",
  "/checkout",
  "/orders",
  "/account",
  "/account-edit",
  "/addresses",
  "/wishlist",
  "/notifications",
  "/admin",
  "/change-password",
];

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    void import("@/lib/performance").then((m) => m.logPerformanceMetrics());
  }, []);



  useEffect(() => {
    let cancelled = false;

    const enforceAuth = async () => {
      const pathname = window.location.pathname;
      if (!isPrivatePath(pathname)) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        const redirectTo = window.location.pathname + window.location.search;
        router.navigate({ to: "/auth", search: { redirect: redirectTo }, replace: true });
      }
    };
    enforceAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      if (event === "SIGNED_OUT") {
        const pathname = window.location.pathname;
        if (isPrivatePath(pathname)) {
          router.navigate({ to: "/auth", replace: true });
        }
      }
    });
    const onRejection = (e: PromiseRejectionEvent) => {
      console.error("[unhandledrejection]", e.reason);
      reportLovableError(e.reason, { mechanism: "unhandledrejection" });
    };
    const onError = (e: ErrorEvent) => {
      console.error("[window.error]", e.error ?? e.message);
      reportLovableError(e.error ?? new Error(e.message), { mechanism: "onerror" });
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <OnboardingGate />
      <NativePushBridge />

      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

