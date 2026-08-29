import { createFileRoute } from "@tanstack/react-router";

// iOS Universal Links verification file. Served as a server route so the SPA
// router's not-found fallback can never intercept it. Apple requires a 200
// with an application/json body and no redirects.
const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "GGGYZ5NH2Q.com.sparklingsilver.app",
        paths: ["/auth-callback", "/auth-callback/*"],
      },
    ],
  },
};

export const Route = createFileRoute("/.well-known/apple-app-site-association")(
  {
    server: {
      handlers: {
        GET: async () =>
          new Response(JSON.stringify(AASA, null, 2), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600",
            },
          }),
      },
    },
  },
);
