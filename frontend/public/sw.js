// Service Worker for PumpLedgerAI PWA App Shell Caching
const CACHE_NAME = "pumpledger-app-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install Event: Cache App Shell & Immediately Skip Waiting
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Delete ALL stale caches from previous builds
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("Purging old cache chunk:", name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network First, Fallback to Cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API requests and storage uploads
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/storage")) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
