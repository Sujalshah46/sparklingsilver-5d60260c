import { createFileRoute } from "@tanstack/react-router";

// Android App Links verification file. Served as a server route so the SPA
// router's not-found fallback can never intercept it.
const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.sparklingsilver.app",
      sha256_cert_fingerprints: [
        "C73380C82A9F5A1384696F15F285CE8B76A471F5A7BA8C37E65E2F12B3C0657A",
      ],
    },
  },
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(ASSET_LINKS, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
