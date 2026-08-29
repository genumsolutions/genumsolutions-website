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

const VERSION = 'v2'

const OFFLINE_URL = '/offline'

const APP_SHELL = [
  '/',
  '/products',
  '/services',
  '/about',
  '/projects',
  '/3d-printing',
  '/journal',
  '/contact',
  '/tools',
  OFFLINE_URL,
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
]

const CACHE_NAME = `genum-shell-${VERSION}`
const ASSET_CACHE = `genum-assets-${VERSION}`

// Private / dynamic paths that must never be served from cache. The public
// products API is the one exception: it powers the offline catalog, so its
// GET responses are cached stale-while-revalidate (see below).
function isPrivate(url) {
  const path = url.pathname
  if (path === '/api/products') return false
  return (
    path.startsWith('/api/') ||
    path.startsWith('/account') ||
    path.startsWith('/admin') ||
    path.startsWith('/checkout') ||
    path.startsWith('/login') ||
    path.startsWith('/auth/')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
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
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Only handle GET requests to our own origin; let everything else through.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (isPrivate(url)) return

  const isNavigation = request.mode === 'navigate'
  const isImageOrIcon = url.pathname.startsWith('/images/')
  const isStaticAsset =
    /\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf)$/.test(url.pathname)

  // Public products API: stale-while-revalidate so the catalog (and its
  // search) keeps working with the last-good data while offline.
  if (url.pathname === '/api/products') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  if (isNavigation) {
    // Network-first: prefer the live page, fall back to cache, then /offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  if (isStaticAsset || isImageOrIcon) {
    // Stale-while-revalidate for static assets.
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // Everything else (documents we don't precache, e.g. /services): cache-as-
  // you-browse so visited pages keep working offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request))
  )
})
