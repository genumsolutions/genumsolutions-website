/* =========================================================================
 * GENUM SOLUTIONS - service worker
 *
 * Offline strategy:
 *  - Precache the app shell and key public pages on install.
 *  - Navigation (page) requests  -> network-first, fall back to cache (so a
 *    visited page stays available while offline), then the offline page.
 *  - Static assets                -> stale-while-revalidate.
 *  - Public /api/products list    -> stale-while-revalidate (offline catalog).
 *  - Private / dynamic routes are NEVER cached: /account, /admin, /checkout,
 *    /login, /auth/* and every other /api/* endpoint.
 *
 * The app (WebView) and the website both benefit: the mobile app mirrors the
 * site, so once a page has been loaded the WebView can serve it from this
 * cache while the device is offline.
 * ========================================================================= */

const VERSION = "v3";

const OFFLINE_URL = "/offline";

// v2 → v3 (2026-09-21): v2's APP_SHELL listed /tools TWICE — Cache.addAll()
// throws on duplicate URLs, so install ALWAYS rejected and the worker never
// activated for anyone (push + offline shell were silently dead). The shell
// is now deduplicated and install precaches each entry independently so a
// single bad URL can never brick the whole worker again.
const APP_SHELL = [
  ...new Set([
    "/",
    "/products",
    "/services",
    "/about",
    "/projects",
    "/tools",
    "/3d-printing",
    "/journal",
    "/contact",
    OFFLINE_URL,
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "/logo.png",
  ]),
];

const CACHE_NAME = `genum-shell-${VERSION}`;
const ASSET_CACHE = `genum-assets-${VERSION}`;

// Private / dynamic paths that must never be served from cache. The public
// products API is the one exception: it powers the offline catalog, so its
// GET responses are cached stale-while-revalidate (see below).
function isPrivate(url) {
  const path = url.pathname;
  if (path === "/api/products") return false;
  return (
    path.startsWith("/api/") ||
    path.startsWith("/account") ||
    path.startsWith("/admin") ||
    path.startsWith("/checkout") ||
    path.startsWith("/login") ||
    path.startsWith("/auth/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Precache each shell entry independently: one failing URL must not
        // reject the whole install (that killed every activation in v2).
        Promise.allSettled(
          APP_SHELL.map((url) =>
            fetch(new Request(url, { cache: "reload" })).then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return cache.put(url, response);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests to our own origin; let everything else through.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isPrivate(url)) return;

  const isNavigation = request.mode === "navigate";
  const isImageOrIcon = url.pathname.startsWith("/images/");
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf)$/.test(url.pathname);

  // Public products API: stale-while-revalidate so the catalog (and its
  // search) keeps working with the last-good data while offline.
  if (url.pathname === "/api/products") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  if (isNavigation) {
    // Network-first: prefer the live page, fall back to cache, then /offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (isStaticAsset || isImageOrIcon) {
    // Stale-while-revalidate for static assets.
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else (documents we don't precache, e.g. /services): cache-as-
  // you-browse so visited pages keep working offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* =========================================================================
 * Web Push (W-3 — no Firebase; standards-based VAPID push)
 *
 * The push-order-status edge function encrypts messages with the browser's
 * subscription keys; the browser (not this script) handles decryption, so
 * there is no secret material here. Payload shape (JSON):
 *   { title, body, url } — url is opened when the notification is tapped.
 * ======================================================================= */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "GENUM SOLUTIONS", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "GENUM SOLUTIONS";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/account" },
    tag: payload.tag || "genum",
  };
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Tell any open pages about the push (the E2E harness listens for this;
      // apps commonly use it to update UI without a refresh).
      return self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) client.postMessage({ type: "PUSH_RECEIVED", payload });
        });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/account";
  const targetUrl = new URL(target, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // P3 §4 tap-through: focus alone was all the old handler did, so with
      // any site tab open the tap never landed on /account#orders. Focus the
      // existing window AND navigate it to the payload target; fall back to
      // opening a new window only when none of ours is open.
      for (const client of clientList) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          const nav =
            typeof client.navigate === "function"
              ? client.navigate(targetUrl).catch(() => undefined)
              : Promise.resolve();
          return Promise.all([client.focus(), nav]);
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
