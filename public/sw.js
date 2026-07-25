/* Sparkling Silver — push notifications + product image cache */
const IMG_CACHE = "ss-img-v3";
const IMG_CACHE_MAX = 2000;

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== IMG_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Stale-while-revalidate for Supabase storage image renders.
// Product thumbnails come from /storage/v1/render/image/... and /storage/v1/object/...
// Serving from cache first turns SKU reloads into an instant paint.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isStorageImg =
    url.pathname.includes("/storage/v1/render/image/") ||
    (url.pathname.includes("/storage/v1/object/") && /\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(url.pathname));
  if (!isStorageImg) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req, { ignoreSearch: false });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
            cache.put(req, res.clone()).then(() => trimCache(cache));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMG_CACHE_MAX) return;
  const excess = keys.length - IMG_CACHE_MAX;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "Sparkling Silver", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Sparkling Silver";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/admin" },
    tag: data.tag || "sparkling-order",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
